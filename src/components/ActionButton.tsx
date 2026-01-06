import { useState } from "react";

type ActionButtonProps = {
  onClick?: () => void | Promise<void>;
  text: string;
  clickedText?: string;
  textColor?: string;
  backgroundColor?: string;
  clickedBackgroundColor?: string;
  borderColor?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
};

export default function ActionButton({
  onClick,
  text,
  clickedText = "Done ✓",
  textColor = "#2f6f4e",
  backgroundColor = "#ffffff",
  clickedBackgroundColor = "#d8f3dc",
  borderColor = "#2f6f4e",
  disabled = false,
  style = {},
} : ActionButtonProps) {
  const [clicked, setClicked] = useState(false);

  const handleClick = async () => {
    if (clicked || disabled) return;

    setClicked(true);
    await onClick?.();
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || clicked}
      style={{
        border: `1px solid ${borderColor}`,
        borderRadius: 10,
        padding: "12px 18px",
        backgroundColor: clicked ? clickedBackgroundColor : backgroundColor,
        color: textColor,
        cursor: clicked || disabled ? "default" : "pointer",
        fontWeight: 600,
        transition: "all 0.2s ease",
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {clicked ? clickedText : text}
    </button>
  );
}
