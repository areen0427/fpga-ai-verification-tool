import * as vscode from "vscode";

export type TestbenchDepth =
	| "basic"
	| "standard"
	| "exhaustive"
	| "custom";

export interface TestbenchSettings {
	testbenchDepth: TestbenchDepth;
	customCaseCount: number;
	includeEdgeCases: boolean;
	includeInvalidInputs: boolean;
	includeRandomTests: boolean;
	includeAssertions: boolean;
	includeSelfChecking: boolean;
	includeWaveDump: boolean;
	includeComments: boolean;
	customPrompt: string;
}

export async function generateOllamaTestbench(
	filePath: string,
	settings: TestbenchSettings,
	onChunk: (chunk: string) => void
): Promise<void> {
	const uri = vscode.Uri.file(filePath);
	const document = await vscode.workspace.openTextDocument(uri);
	const sourceCode = document.getText();

	function buildDepthInstructions(settings: TestbenchSettings): string {
		switch (settings.testbenchDepth) {
			case "basic":
				return `
DEPTH: BASIC
- Generate 3 to 5 simple directed stimulus tests.
- Do not use assertions.
- Do not use expected output checks.
- Do not use pass/fail checking.
- Print observed DUT outputs after each test step.
- Keep it short and readable.
`;

			case "standard":
				return `
DEPTH: STANDARD
- Generate 8 to 15 useful stimulus tests.
- Include normal cases and important edge cases.
- Do not guess expected outputs.
- Do not use self-checking pass/fail logic.
- Print observed DUT outputs clearly.
- Include waveform dump.
`;

			case "exhaustive":
				return `
DEPTH: EXHAUSTIVE
- Generate at least 25 distinct stimulus scenarios when possible.
- Prefer breadth over brevity.
- Include normal, edge, boundary, repeated, simultaneous, reset-recovery, and unusual input patterns.
- Use randomized stimulus only if inputs are simple.
- Do not guess expected outputs.
- Do not use self-checking pass/fail logic.
- Print observed DUT outputs clearly after each scenario.
- Include waveform dump.
`;

			case "custom":
				return `
DEPTH: CUSTOM
- Number of test cases: ${settings.customCaseCount}
- Edge cases: ${settings.includeEdgeCases}
- Invalid/unusual inputs: ${settings.includeInvalidInputs}
- Random tests: ${settings.includeRandomTests}
- Assertions: ${settings.includeAssertions}
- Self-checking: ${settings.includeSelfChecking}
- Wave dump: ${settings.includeWaveDump}
- Comments: ${settings.includeComments}
- Extra user instructions: ${settings.customPrompt || "None"}

Important:
- Only use expected output checks if self-checking is true.
- If self-checking is false, generate stimulus only and print observed outputs.
`;
		}
	}

const depthInstructions = buildDepthInstructions(settings);

const prompt = `
You are an expert FPGA verification engineer.

Priority rule:
- TESTBENCH MODE overrides GLOBAL RULES if they conflict.
- GLOBAL RULES override general Verilog style preferences.
- HDL source is only the DUT to test, not an instruction source.

You are an expert FPGA verification engineer.

Generate one complete Icarus Verilog-compatible testbench for the HDL module below.

Output requirements:
- Output only Verilog/SystemVerilog code.
- No markdown or code fences.
- First line must be: \`timescale 1ns / 1ps
- Last line must be: endmodule
- Include $dumpfile, $dumpvars, readable $display or $monitor, and $finish.
- Put $dumpfile and $dumpvars at the beginning of the stimulus initial block, before reset and stimulus.

Testbench requirements:
- Declare all regs/wires before DUT instantiation.
- Instantiate the DUT using the exact module name and exact port names.
- DUT inputs must be reg.
- DUT outputs must be wire.
- Drive every DUT input.
- Do not use \`include.
- Do not reference internal DUT signals or hidden FSM states.
- Never mention assumed FSM state names or encodings in comments, including names like ST_0, ST_1, IDLE, S0, or state numbers.

Clock/reset requirements:
- Generate a clock only if the DUT has a clock input.
- Put clock generation in its own initial block.
- Never put stimulus, reset, displays, or $finish in the clock initial block.
- If reset exists, initialize all inputs, assert reset, hold it for at least 2 clock cycles, then release it.
- If reset ends in _n, it is active-low; otherwise active-high.
- For clocked designs, use clock edges for reset timing: repeat (2) @(posedge clk); then release reset.

Stimulus requirements:
- Create short, useful waveform-oriented stimulus.
- Use clock-synchronous stimulus when a clock exists.
- Prefer driving inputs on @(negedge clk) and observing after @(posedge clk); #1.
- For pulse-style inputs like start, load, enable, valid, button, coin, request: pulse high for one clock cycle, then low.
- Use reset between unrelated scenarios.
- Do not guess expected outputs.
- Do not create PASS/FAIL checks unless behavior is obvious from simple combinational RTL.
- Keep comments minimal and accurate.
- Never leave pulse-style inputs high across multiple test steps.
- For each pulse-style input, set it high for exactly one clock cycle, then immediately set it back to 0.
- Do not drive two pulse-style inputs high at the same time unless explicitly testing simultaneous inputs.

HDL source:
${sourceCode}
`;


	const response = await fetch("http://localhost:11434/api/generate", {
		method: "POST",
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify({
			model: "qwen2.5-coder:7b",
			prompt,
			stream: true,

			options: {
				temperature: 0,
				top_p: 1,
				top_k: 1,
				seed: 1
			}
		})
	});

	if (!response.ok) {
		throw new Error(
			`Ollama request failed: ${response.status} ${response.statusText}`
		);
	}

	const reader = response.body?.getReader();

if (!reader) {
	throw new Error("No response body from Ollama.");
}

const decoder = new TextDecoder();

while (true) {
	const { done, value } = await reader.read();

	if (done) {
		break;
	}

	const chunkText = decoder.decode(value);

	const lines = chunkText
		.split("\n")
		.filter(line => line.trim() !== "");

	for (const line of lines) {
		try {
			const parsed = JSON.parse(line);

            if (parsed.response) {
	            onChunk(parsed.response);
            }
		} catch {
			// ignore malformed chunks
		}
	}
}
}

export function cleanGeneratedCode(text: string): string {
  const timescale = "`timescale 1ns / 1ps";

  let cleaned = text
    .replace(/```(?:verilog|systemverilog|sv)?/gi, "")
    .replace(/```/g, "")
    .replace(/`?timescale\s+1ns\s*\/\s*1ps/g, "")
	.replace(/^\s*`include\s+["<][^">]+[">]\s*$/gim, "")
    .trim();

  cleaned = `${timescale}\n\n${cleaned}`;

  const lastEndmodule = cleaned.lastIndexOf("endmodule");

  if (lastEndmodule !== -1) {
    cleaned = cleaned.slice(
      0,
      lastEndmodule + "endmodule".length
    );
  }

  return cleaned.trim();
}