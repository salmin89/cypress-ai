import OpenAI from 'openai';
import fs from 'fs';
import * as readline from "readline";

const openai = new OpenAI({
    apiKey: 'your openai key',
});

function isCypressFailedRunResult(
    result: CypressCommandLine.CypressRunResult | CypressCommandLine.CypressFailedRunResult
  ): result is CypressCommandLine.CypressFailedRunResult {
    return "status" in result;
  }

export async function cypressAI(result: CypressCommandLine.CypressRunResult | CypressCommandLine.CypressFailedRunResult) {
    if (isCypressFailedRunResult(result)) return;
    if (result.totalFailed === 0) return;

    await Promise.all(
        result.runs.map((run) => {
            return Promise.all(
                run.tests.map(async (test) => {
                    if (test.state === 'passed') return;
                    const screenshotFile = fs.readFileSync(run.screenshots[0].path);
                    const screenshotBase64 = screenshotFile.toString("base64");

                    const twirlTimer = createSpinner();
                    const chatCompletion = await openai.chat.completions.create(
                        {
                            messages: [
                                {
                                    role: 'user',
                                    content: [
                                        {
                                            type: 'text',
                                            text: `I have a Cypress test failure with the following error: ${test.displayError}. Here is my spec file: ${run.spec.absolute} Can you provide general advice on what could be wrong and how to troubleshoot this type of error? Please keep your answer short and concise. This will be used for the error output in a users terminal.`,
                                        },
                                        {
                                            type: 'image_url',
                                            image_url: {
                                                url: `data:image/jpeg;base64,${screenshotBase64}`,
                                            },
                                        },
                                    ],
                                },
                            ],
                            model: 'gpt-4-vision-preview',
                        }
                    );

                    clearSpinner(twirlTimer);

                    console.log(`
==============================

[Specfile]: ${run.spec.absolute}

[Error]: ${test.displayError}

[Suggested solutions]: 
`);
          chatCompletion.choices.forEach((choice) => {
            console.log(`\x1b[33m ${choice.message.content} \x1b[0m`);
            console.log("\r");
          });
        })
      );
    })
  );
}

function createSpinner() {
    const P = ["\\", "|", "/", "-"];
    let x = 0;
    return setInterval(function () {
      process.stdout.write(`\r  generating solutions ${P[x++]}`);
      x &= 3;
    }, 250);
  }
  
  function clearSpinner(ref: NodeJS.Timeout) {
    clearInterval(ref);
    readline.clearLine(process.stdout, 0);
  }
  