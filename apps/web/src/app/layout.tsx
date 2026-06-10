export const metadata = {
  title: "Mistra — Production comptable",
  description: "Chaîne de production comptable pour cabinets d'expertise comptable",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body style={{ fontFamily: "system-ui, -apple-system, sans-serif", margin: 0, background: "#f9fafb", color: "#1f2937" }}>
        {children}
      </body>
    </html>
  );
}
