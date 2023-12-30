import { Elysia, t } from "elysia";
import { unlink } from "node:fs/promises";

const allowedApiKeys = new Set((process.env.ALLOWED_API_KEYS || "").split(","));

async function getPdf(
  form: FormData
): Promise<
  { success: false; log: string } | { success: true; arrayBuffer: ArrayBuffer }
> {
  // Workaround of Bun not doing multipart/form-data well
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

  const isPdf = pdfResponse.headers
    .get("Content-Type")
    ?.includes("application/pdf");

  if (!isPdf) return { success: false, log: await pdfResponse.text() };
  return { success: true, arrayBuffer: await pdfResponse.arrayBuffer() };
}

const app = new Elysia()

  .onBeforeHandle(({ request, set }) => {
    if (process.env.NODE_ENV === "development") return;
    const auth = request.headers.get("Authorization");
    const token = auth?.split(" ").at(1);
    if (!token || !allowedApiKeys.has(token)) {
      set.status = 401;
      return "Unauthorized";
    }
  })

  .post(
    "/v1",
    async ({ body, set }) => {
      const form = new FormData();
      form.append("filename[]", "document.tex");
      form.append("filecontents[]", body.fileContent);
      form.append("return", "pdf");

      const result = await getPdf(form);

      if (!result.success) {
        set.status = 400;
        set.headers["Content-Type"] = "text/plain";
        return result.log;
      }

      const pdfFileName = `/tmp/${crypto.randomUUID()}.pdf`;
      const svgFileName = `/tmp/${crypto.randomUUID()}.svg`;
      await Bun.write(pdfFileName, result.arrayBuffer);

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
    },
    { body: t.Object({ fileContent: t.String() }) }
  )

  .listen(process.env.PORT || 3000);

console.log(`Running at ${app.server?.hostname}:${app.server?.port}`);
