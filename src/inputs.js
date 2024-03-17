import fs from 'fs';
import path from 'path';

/*
    This file is part of an extension to snarkjs, developed by turnoffthiscomputer during ETHGlobal London 2024.

    The extension aims to streamline the process of generating inputs for zk-SNARK circuits, enhancing the usability and accessibility of zero-knowledge proofs in Ethereum applications.

    The modifications are distributed in the hope that they will be useful to the Ethereum and zero-knowledge proof community.
*/


export async function generateInput(circuitPath, isRustFormat) {
    const outputPath = 'input.json';

    circuitPath = String(circuitPath);
    let inputTemplate = await generateInputTemplateForMainComponent(circuitPath);
    if (isRustFormat) {
        inputTemplate = convertToRustFormat(inputTemplate);
    }

    fs.writeFileSync(outputPath, JSON.stringify(inputTemplate, null, 2));
}

async function generateInputTemplateForMainComponent(circuitPath) {
    const resolvedPath = path.resolve(circuitPath);
    const circuitContent = fs.readFileSync(resolvedPath, 'utf8');
    const lines = circuitContent.split('\n');
    const inputTemplate = {};

    let mainComponentDeclaration = lines.find(line => line.includes('component main'));
    if (!mainComponentDeclaration) {
        throw new Error('Main component declaration not found.');
    }

    const mainComponentMatch = mainComponentDeclaration.match(/component main.*=\s*(\w+)\(([^)]*)\)/);
    if (!mainComponentMatch) {
        throw new Error('Could not parse main component declaration.');
    }

    const mainTemplateName = mainComponentMatch[1];
    const mainTemplateParamsValues = mainComponentMatch[2].split(',').map(param => param.trim());

    const mainTemplateDefinition = lines.find(line => line.includes(`template ${mainTemplateName}(`));
    if (!mainTemplateDefinition) {
        throw new Error(`Template definition for ${mainTemplateName} not found.`);
    }

    const templateParamsMatch = mainTemplateDefinition.match(/template \w+\(([^)]*)\)/);
    if (!templateParamsMatch) {
        throw new Error(`Could not parse template parameters for ${mainTemplateName}.`);
    }

    const templateParamNames = templateParamsMatch[1].split(',').map(param => param.trim());

    const paramsMapping = templateParamNames.reduce((acc, paramName, index) => {
        const value = mainTemplateParamsValues[index] ? parseInt(mainTemplateParamsValues[index], 10) : 0;
        acc[paramName] = isNaN(value) ? 0 : value; // Default to 0 if not a number
        return acc;
    }, {});

    const mainTemplateStartIndex = lines.findIndex(line => line.includes(`template ${mainTemplateName}(`));
    const mainTemplateEndIndex = lines.findIndex((line, index) => line.includes('}') && index > mainTemplateStartIndex);
    const mainTemplateLines = lines.slice(mainTemplateStartIndex, mainTemplateEndIndex + 1);

    mainTemplateLines.forEach(line => {
        const inputMatch = line.match(/signal input (\w+)(\[(\w+)\])?;/);
        if (inputMatch) {
            const inputName = inputMatch[1];
            const isArray = inputMatch[2];
            const arraySizeParam = inputMatch[3];
            if (isArray) {
                const arraySize = isNaN(arraySizeParam) ? (paramsMapping[arraySizeParam] || 0) : parseInt(arraySizeParam, 10);
                inputTemplate[inputName] = new Array(arraySize).fill(0);
            } else {
                inputTemplate[inputName] = 0;
            }
        }
    });

    return inputTemplate;
}

function convertToRustFormat(inputTemplate) {
    const rustFormat = {};
    for (const [key, value] of Object.entries(inputTemplate)) {
        if (Array.isArray(value)) {
            rustFormat[key] = value.map(v => `0x${v.toString(16)}`);
        } else {
            rustFormat[key] = [`0x${value.toString(16)}`];
        }
    }
    return rustFormat;
}


