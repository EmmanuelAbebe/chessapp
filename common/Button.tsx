import { ReactNode } from "react";

interface ButtonProps {
  label: ReactNode;
  onClick?: () => void;
  className?: string;
}

const Button = ({ label, className = "", onClick }: ButtonProps) => {
  return (
    <button
      className={`${className} px-2 py-1 rounded cursor-pointer text-white text-sm font-bold bg-blue-500 hover:bg-blue-400 active:bg-blue-600`}
      onClick={onClick}
    >
      {label}
    </button>
  );
};

export default Button;
