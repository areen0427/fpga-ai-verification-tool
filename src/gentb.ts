import * as vscode from "vscode";

export async function generateOllamaTestbench(
	filePath: string,
	onChunk: (chunk: string) => void
): Promise<void> {
	const uri = vscode.Uri.file(filePath);
	const document = await vscode.workspace.openTextDocument(uri);

	const sourceCode = document.getText();

	const prompt = `
You are an expert FPGA verification engineer.

Generate a Verilog/SystemVerilog testbench for the HDL module below.

Rules:
- Output ONLY code.
- Do NOT use markdown.
- Do NOT use triple backticks.
- Do NOT explain anything.
- Include \`timescale 1ns / 1ps.
- Instantiate the DUT.
- Generate a clock if a clock input exists.
- Generate reset stimulus if reset exists.
- Add simple meaningful test cases.
- Add $display statements.
- End with $finish.

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
			stream: true
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