import React, { useEffect, useState } from "react";
import RemoveIcon from "@mui/icons-material/Remove";
import AddIcon from "@mui/icons-material/Add";
import IconButton from "@mui/material/IconButton";
import { Cat } from "../../types/Cat.ts";

interface GalleryProps {
  files: Map<number, File>;
  setCat: React.Dispatch<React.SetStateAction<Cat>>;
}

const Gallery: React.FC<GalleryProps> = ({ files, setCat }) => {
  const [columns, setColumns] = useState<string[][]>([[], []]);
  const [isCollapsed, setIsCollapsed] = useState(true);

  useEffect(() => {
    // Convert the map into an array of URLs and distribute into columns
    const fileEntries = Array.from(files.entries());
    const newColumns: [string[], string[]] = [[], []];

    fileEntries.forEach(([key, file], index) => {
      const url = URL.createObjectURL(file);
      newColumns[index % 2].push(url);
    });

    setColumns(newColumns);
  }, []);

  const handleRemove = (key: number) => {
    // Remove the file from the map and update Cat state
    setCat((prevCat) => {
      const updatedImages = new Map(prevCat.primaryInfo.images);
      updatedImages.delete(key);
      if (updatedImages.size == 0) setIsCollapsed(true);
      return {
        ...prevCat,
        primaryInfo: { ...prevCat.primaryInfo, images: updatedImages },
      };
    });
  };

  return (
    <div>
      <div
        className={`flex gap-x-4 ${
          isCollapsed ? "h-24 overflow-y-scroll" : ""
        }`}
      >
        {columns.map((column, colIndex) => (
          <div key={colIndex} className="flex-1 space-y-4">
            {Array.from(files.entries())
              .filter((_, index) =>
                index % 2 === colIndex
              )
              .map(([key, file]) => {
                const src = URL.createObjectURL(file);
                return (
                  <div key={key} className="relative">
                    <IconButton
                      color="primary"
                      sx={{
                        position: "absolute",
                        right: "5px",
                        top: "5px",
                        width: "25px",
                        height: "25px",
                        background: "#fff",
                        "&:hover": {
                          background: "#bbb",
                        },
                      }}
                      onClick={() => handleRemove(key)}
                    >
                      <RemoveIcon />
                    </IconButton>
                    <img
                      className="rounded-md"
                      src={src}
                      alt={`Image ${key}`}
                    />
                  </div>
                );
              })}
          </div>
        ))}
      </div>
      <IconButton onClick={() => setIsCollapsed((prev) => !prev)}>
        {files.size > 0 && (isCollapsed ? <AddIcon /> : <RemoveIcon />)}
      </IconButton>
    </div>
  );
};

export default Gallery;
