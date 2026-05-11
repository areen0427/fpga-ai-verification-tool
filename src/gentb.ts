import * as vscode from "vscode";

export async function generateDummyTestbench(
	filePath: string
): Promise<string> {

	const uri = vscode.Uri.file(filePath);
	const document = await vscode.workspace.openTextDocument(uri);

	const text = document.getText();

	const moduleMatch = text.match(/module\s+(\w+)/);

	const moduleName = moduleMatch
		? moduleMatch[1]
		: "unknown_module";

	return `\`timescale 1ns / 1ps

// ========================================
// AUTO-GENERATED TESTBENCH (DUMMY)
// ========================================

module ${moduleName}_tb;

	// Dummy signals
	reg clk;
	reg reset;
	reg enable;

	wire done;

	// DUT
	${moduleName} dut (
		// TODO: connect ports
	);

	// Clock generation
	initial begin
		clk = 0;

		forever #5 clk = ~clk;
	end

	// Stimulus
	initial begin

		reset = 1;
		enable = 0;

		#20;

		reset = 0;
		enable = 1;

		#100;

		$display("Dummy testbench completed.");

		$finish;
	end

endmodule
`;
}