import * as vscode from 'vscode';

export async function findHDLFiles(): Promise<vscode.Uri[]> {
	return vscode.workspace.findFiles(
		"**/*.{v,sv,vhd,vhdl}",
		"**/{node_modules,.git,out,dist}/**"
	);
}