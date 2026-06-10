export function Button({ children, onClick, disabled, variant = "primary", type = "button" }: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  type?: "button" | "submit";
}) {
  const bg = variant === "primary" ? "#3b82f6" : variant === "danger" ? "#ef4444" : "#e5e7eb";
  const color = variant === "secondary" ? "#1f2937" : "#fff";
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      padding: "8px 16px", background: disabled ? "#9ca3af" : bg, color,
      border: "none", borderRadius: 6, cursor: disabled ? "not-allowed" : "pointer", fontSize: 14,
    }}>
      {children}
    </button>
  );
}
