import { SimpleTest } from "./types/manifest.js";
import { Rdf2CsvOptions, Rdf2CsvwConvertor } from "../src/index.js";
import { readdirSync, statSync } from "fs";
import { join } from "path";
import { readFileSync } from "fs";
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const pathToTests = "test/rdf2csvwtests";
let tests: SimpleTest[] = [];

 const options: Rdf2CsvOptions = {
        pathOverrides: [
          [
            'http://www.w3.org/ns/csvw',
            pathToFileURL(resolve(pathToTests, '../ns/csvw.jsonld')).href,
          ]
        ]};

const convertor: Rdf2CsvwConvertor = new Rdf2CsvwConvertor(options);

const testDataJson = readFileSync(join(pathToTests, 'testData.json'), 'utf-8');
console.log(testDataJson);
tests = JSON.parse(testDataJson) as SimpleTest[];
console.log(tests);
const testFolders = getFolderNames(pathToTests);
console.log(testFolders);
for(let i =0;i<testFolders.length;i++) {
    console.log(i)
    const inputDescriptor = readFileSync(pathToTests+`/${testFolders[i]}/descriptor.json`, "utf-8");
    const inputDataPath = pathToTests+`/${testFolders[i]}/input.json`;
    const expectedOutput = readFileSync(pathToTests+`/${testFolders[i]}/result.csv`, "utf-8");
    console.log(tests[i]);
    tests[i] = {
        id: tests[i].id,
        name: tests[i].name,
        inputDataPath,
        expectedOutput,
        inputDescriptor,
        expectsError: tests[i].expectsError || false,
        expectsWarning: tests[i].expectsWarning || false,
    };
}

describe('rdf2csvw', () => {

    tests.forEach(test => {
        it(test.name, async () => {
            const result = await convertor.convert(test.inputDataPath,test.inputDescriptor);
            expect(result).toEqual(test.expectedOutput);
        });
    });
});

function getFolderNames(dirPath: string): string[] {
    return readdirSync(dirPath)
        .filter(name => statSync(join(dirPath, name)).isDirectory());
}