import type { PickedWebFile } from "./types";

export function pickFile(): Promise<PickedWebFile | null> {
	return new Promise(function (resolve: (value: PickedWebFile | null) => void) {
		const input = document.createElement("input");
		input.type = "file";
		input.style.display = "none";

		input.onchange = function (e: Event) {
			const target = e.target as HTMLInputElement;
			const file = target.files ? target.files[0] : null;
			if (!file) {
				resolve(null);
				return;
			}
			resolve({
				name: file.name,
				type: file.type || "application/octet-stream",
				size: file.size,
				file: file
			});
			document.body.removeChild(input);
		};

		(input as HTMLInputElement).oncancel = function () {
			resolve(null);
			document.body.removeChild(input);
		};

		document.body.appendChild(input);
		input.click();
	});
}
