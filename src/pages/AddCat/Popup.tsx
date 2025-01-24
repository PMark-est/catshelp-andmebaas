import React, { useState } from "react";

interface PopupProps {
  isVisible: boolean;
  slidingDown: boolean;
  slidingUp: boolean;
  onClose: () => void;
  title?: string;
  children?: React.ReactNode;
}

const Popup: React.FC<PopupProps> = ({
  isVisible,
  slidingDown,
  slidingUp,
  onClose,
  title,
  children,
}) => {
  if (!isVisible) return null;

  //className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-lg w-96 p-6 animate-slide-down cursor-pointer"
  return (
    <div
      onClick={onClose} // Close popup when clicked
      className={`absolute top-6 bg-slate-200 rounded-lg shadow-lg w-96 p-4 cursor-pointer ${
        slidingDown ? "animate-slide-down" : ""
      } 
      ${slidingUp ? "animate-slide-up" : ""}
      `}
    >
      {title && <h2 className="text-lg font-semibold">{title}</h2>}
      <div>{children}</div>
    </div>
  );
};

export default Popup;
