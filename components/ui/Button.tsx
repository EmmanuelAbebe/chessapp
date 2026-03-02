interface ButtonProps {
  label: string;
  className?: string;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
}

const Button = (props: ButtonProps) => {
  return (
    <button
      type={props.type || "button"}
      className={`bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded ${props.className || ""}`}
      onClick={props.onClick}
    >
      {props.label}
    </button>
  );
};

export default Button;
