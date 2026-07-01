export default function handler(_req, res) {
  res.status(410).json({
    ok: false,
    message: "Worker pesado Vercel desativado na arquitetura V2. Use o Motor Local EXE.",
  });
}
