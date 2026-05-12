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
	- Generate 3 to 5 simple directed tests.
	- No random tests.
	- No complex tasks/classes.
	- Simple pass/fail $display messages.
	`;

				case "standard":
					return `
	DEPTH: STANDARD
	- Generate 8 to 15 directed tests.
	- Include normal and edge cases.
	- Include self-checking when outputs are clear.
	- Include waveform dump.
	`;

				case "exhaustive":
					return `
	DEPTH: EXHAUSTIVE
	- Generate 25+ tests when reasonable.
	- Include normal, edge, boundary, repeated, and unusual cases.
	- Use random tests only if the inputs are simple.
	- Include waveform dump and detailed pass/fail messages.
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
	`;
			}
		}

		const prompt = `
	You are an FPGA verification engineer.

	Generate one complete Icarus Verilog-compatible testbench for the HDL module below.

	Output rules:
	- Output only Verilog/SystemVerilog code.
	- No markdown.
	- No triple backticks.
	- Start with: \`timescale 1ns / 1ps
	- End with: endmodule
	- The simulation must call $finish.

	Testbench rules:
	- Instantiate the DUT using the exact module ports.
	- Generate clk only if the DUT has a clock input.
	- Generate reset only if the DUT has a reset input.
	- Only check public output ports.
	- Do not reference internal signals or hidden FSM states.
	- Drive inputs before the active clock edge.
	- Check outputs after the DUT has had time to update.
	- If using a forever clock, the stimulus block must still end with $finish.
	- Keep runtime short.

	Task rules:
	- If using a check task, expected values must be task inputs.
	- Never declare expected values as task outputs.
	- Never pass constants like 1'b0 or 1'b1 into task output/inout ports.
	- Compare expected values against DUT outputs inside the task.

	FSM/sequential rules:
	- Reset the DUT before independent test cases.
	- Only keep state between steps when testing an intentional sequence.
	- For FSMs, verify behavior through outputs only.
	- For vending machines, check dispense/refund outputs, not state names.

	${buildDepthInstructions(settings)}

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