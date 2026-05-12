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
): Promise<void>{
	const uri = vscode.Uri.file(filePath);
	const document = await vscode.workspace.openTextDocument(uri);

	const sourceCode = document.getText();

	function buildDepthInstructions(settings: TestbenchSettings): string {
		if (settings.testbenchDepth === "basic") {
			return `
	DEPTH MODE: BASIC

	Generate a simple starter testbench.

	Strict requirements:
	- Use about 3 to 5 directed test cases.
	- Do not use randomized testing.
	- Do not use assertions unless extremely simple.
	- Do not create complex tasks/classes.
	- Include clock/reset only if the DUT needs them.
	- Include simple $display messages.
	- Prioritize readability over coverage.
	`;
		}

		if (settings.testbenchDepth === "standard") {
			return `
	DEPTH MODE: STANDARD

	Generate a practical verification testbench.

	Strict requirements:
	- Use about 8 to 15 directed test cases.
	- Include normal cases.
	- Include important edge cases.
	- Include basic self-checking with expected values when possible.
	- Include $display pass/fail messages.
	- Include waveform dump.
	- Avoid overly complex randomized testing.
	`;
		}

		if (settings.testbenchDepth === "exhaustive") {
			return `
	DEPTH MODE: EXHAUSTIVE

	Generate a thorough verification testbench.

	Strict requirements:
	- Use 25 or more test cases when reasonable.
	- Include normal cases, edge cases, boundary cases, and repeated scenarios.
	- Include invalid/unusual input combinations when appropriate.
	- Include randomized testing if inputs are suitable.
	- Include self-checking logic with expected values when possible.
	- Include assertions when compatible with Icarus Verilog.
	- Include waveform dump.
	- Include detailed pass/fail reporting.
	- Try to maximize behavioral coverage.
	`;
		}

		return `
	DEPTH MODE: CUSTOM

	Generate a testbench using exactly these user-selected options:

	Number of test cases: ${settings.customCaseCount}
	Include edge cases: ${settings.includeEdgeCases}
	Include invalid/unusual inputs: ${settings.includeInvalidInputs}
	Include randomized tests: ${settings.includeRandomTests}
	Include assertions: ${settings.includeAssertions}
	Include self-checking logic: ${settings.includeSelfChecking}
	Include waveform dump: ${settings.includeWaveDump}
	Include comments: ${settings.includeComments}

	Additional custom AI instructions:
	${settings.customPrompt || "None"}
	`;
	}

	const prompt = `
	You are an expert FPGA verification engineer.

	Generate a Verilog/SystemVerilog testbench for the HDL module below.

	Rules:
	- Output ONLY code.
	- Do NOT use markdown.
	- Do NOT use triple backticks.
	- Do NOT explain anything.
	- Include \`timescale 1ns / 1ps.
	- Instantiate the DUT correctly.
	- Generate a clock if needed.
	- Generate reset logic if needed.
	- End with endmodule.
	- Make the testbench compatible with Icarus Verilog when possible.
	- Only check DUT output ports.
	- Do NOT check internal states unless the state signal is an actual output port.
	- If internal FSM states are not exposed, infer behavior only from public outputs.
	- Do NOT write expectations like "state should be ST_1" unless state is connected to an output.
	- For vending machine FSMs, check dispense/refund behavior, not hidden state names.

	Testbench generation settings:
	${buildDepthInstructions(settings)}

	Important:
	- The selected depth mode must strongly control the complexity of the generated testbench.
	- Basic should be short and simple.
	- Standard should be practical and moderately thorough.
	- Exhaustive should be much more complete and aggressive.
	- Custom should follow the user-selected options exactly.
	- The testbench MUST call $finish.
	- The testbench MUST NOT run forever.
	- If using forever clock generation, the stimulus block must still end with $finish.
	- Keep simulation runtime short.
	- For sequential logic or FSMs, each independent test case MUST reset the DUT before starting.
	- Do not let state carry over between independent test cases unless the test is explicitly checking a multi-step sequence.
	- Drive inputs on clock boundaries using @(negedge clk) or before @(posedge clk).
	- Check outputs only after the DUT has had enough clock edges to update.
	- For FSMs, prefer a reusable reset_dut task and check_case task.
	- If a test checks a sequence, clearly keep it in one named sequence test.
	- Do not assume the DUT starts from idle unless reset_dut was called.
	- Never check outputs immediately after changing inputs for sequential logic.
	- For Moore-style FSM outputs, wait one full clock cycle after the state transition before checking outputs.
	- For Mealy-style FSM outputs, still check after inputs have settled and timing is clear.

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

function cleanGeneratedCode(text: string): string {
	return text
		.replace(/```verilog/g, "")
		.replace(/```systemverilog/g, "")
		.replace(/```sv/g, "")
		.replace(/```/g, "")
		.trim();
}