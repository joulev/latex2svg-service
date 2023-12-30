import { Elysia, t } from "elysia";
import { unlink } from "node:fs/promises";

const allowedApiKeys = new Set((process.env.ALLOWED_API_KEYS || "").split(","));

const content = `
\\documentclass[tikz]{standalone}
\\usetikzlibrary{fadings}
\\begin{document}
\\begin{tikzpicture}
  \\draw[-latex] (-.5,0) node[left] {$0$} --(5,0) node[right] {$t$/s};
  \\draw[-latex] (0,-.5) node[below] {$0$} --(0,3.5) node[left] {$A$/mm};
  \\draw (.2,2.7)--(-.2,2.7) node[left] {$A_0$};
  \\draw [very thick, red] (0,2.7) to [out=-45, in =170] (4.5,.5);
\\end{tikzpicture}
\\end{document}
`.trim();

// Workaround of Bun not doing multipart/form-data well
async function getPdf(form: FormData) {
  const textBody = await new Response(form).text();
  const pdfResponse = await fetch("https://texlive.net/cgi-bin/latexcgi", {
    method: "POST",
    body: textBody,
    headers: {
      "Content-Type": `multipart/form-data; boundary=${textBody
        .split("\n")[0]
        .slice(2)}`,
    },
  });
  return pdfResponse;
}

const app = new Elysia()

  .onBeforeHandle(({ request, set }) => {
    const auth = request.headers.get("Authorization");
    const token = auth?.split(" ").at(1);
    if (!token || !allowedApiKeys.has(token)) {
      set.status = 401;
      return "Unauthorized";
    }
  })

  .get("/v1", async ({ set }) => {
    const form = new FormData();
    form.append("filename[]", "document.tex");
    form.append("filecontents[]", content);
    form.append("return", "pdf");

    const pdfResponse = await getPdf(form);

    const pdfFileName = `/tmp/${crypto.randomUUID()}.pdf`;
    const svgFileName = `/tmp/${crypto.randomUUID()}.svg`;
    await Bun.write(pdfFileName, pdfResponse);

    // Only capture the first page
    const process = Bun.spawnSync(["pdf2svg", pdfFileName, svgFileName, "1"]);

    if (!process.success) {
      set.status = 500;
      return process.stderr;
    }

    const svg = await Bun.file(svgFileName).text();

    // Delete the temporary files
    Promise.all([pdfFileName, svgFileName].map(unlink));

    set.headers["Content-Type"] = "image/svg+xml";
    return svg;
  })

  .listen(process.env.PORT || 3000);

console.log(`Running at ${app.server?.hostname}:${app.server?.port}`);
