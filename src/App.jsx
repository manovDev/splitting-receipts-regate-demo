import React, { useRef, useState, useEffect } from "react";
import {
  Stage,
  Layer,
  Image as KonvaImage,
  Rect,
  Group,
  Transformer,
  Text,
} from "react-konva";
import useImage from "use-image";

const IMAGE_URL = "/image.png";

let idCounter = 0;
const generateId = () => `selection-${idCounter++}`;

export default function App() {
  const [image] = useImage(IMAGE_URL);
  const [selections, setSelections] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [creatingStart, setCreatingStart] = useState(null);
  const [newSelection, setNewSelection] = useState(null);

  const stageRef = useRef();
  const trRef = useRef();
  const selectionRefs = useRef({});

  useEffect(() => {
    const node = selectionRefs.current[selectedId];
    if (selectedId && trRef.current && node) {
      trRef.current.nodes([node]);
      trRef.current.getLayer().batchDraw();
    } else {
      trRef.current?.nodes([]);
      trRef.current?.getLayer()?.batchDraw();
    }
  }, [selectedId, selections]);

  const cropFromImage = (x, y, width, height) => {
    if (!image || !stageRef.current) return null;
    const stage = stageRef.current;
    const imageNode = stage.findOne("Image");
    if (!imageNode) return null;

    const displayedWidth = imageNode.width();
    const displayedHeight = imageNode.height();
    const scaleX = image.width / displayedWidth;
    const scaleY = image.height / displayedHeight;

    const cropX = x * scaleX;
    const cropY = y * scaleY;
    const cropWidth = width * scaleX;
    const cropHeight = height * scaleY;

    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = Math.abs(cropWidth);
    cropCanvas.height = Math.abs(cropHeight);
    const ctx = cropCanvas.getContext("2d");

    ctx.drawImage(
      image,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      cropCanvas.width,
      cropCanvas.height
    );

    return cropCanvas.toDataURL();
  };

  const addSelection = (x, y, width, height) => {
    const id = generateId();
    const uri = cropFromImage(x, y, width, height);
    if (!uri) return;
    setSelections((prev) => [...prev, { id, x, y, width, height, uri }]);
  };

  const updateSelection = (id, node) => {
    const x = node.x();
    const y = node.y();
    const width = node.width() * node.scaleX();
    const height = node.height() * node.scaleY();

    node.scaleX(1);
    node.scaleY(1);

    const uri = cropFromImage(x, y, width, height);
    if (!uri) return;

    setSelections((prev) =>
      prev.map((sel) => (sel.id === id ? { ...sel, x, y, width, height, uri } : sel))
    );
  };

  const handleStageMouseDown = (e) => {
    const clickedOnStage = e.target === e.target.getStage();
    const isTransformHandle = e.target?.getParent()?.className === "Transformer";
    const clickedNode = e.target;
    const isExisting = selections.some((sel) => selectionRefs.current[sel.id] === clickedNode);
    if (!clickedOnStage && (isExisting || isTransformHandle)) return;
    const pointerPos = e.target.getStage().getPointerPosition();
    setCreatingStart(pointerPos);
    setSelectedId(null);
  };

  const handleStageMouseMove = (e) => {
    if (!creatingStart) return;
    const pointerPos = e.target.getStage().getPointerPosition();
    const width = pointerPos.x - creatingStart.x;
    const height = pointerPos.y - creatingStart.y;
    setNewSelection({ x: creatingStart.x, y: creatingStart.y, width, height });
  };

  const handleStageMouseUp = () => {
    if (newSelection && Math.abs(newSelection.width) > 5 && Math.abs(newSelection.height) > 5) {
      addSelection(newSelection.x, newSelection.y, newSelection.width, newSelection.height);
    }
    setCreatingStart(null);
    setNewSelection(null);
  };

  const blurMaskEnabled = selections.length > 0 || newSelection !== null;

  return (
    <div style={{ display: "flex", gap: "24px", padding: 24 }}>
      <Stage
        width={800}
        height={(image?.height / image?.width) * 800 || 1000}
        ref={stageRef}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        style={{ border: "1px solid #ccc" }}
      >
        <Layer>
          {image && (
            <KonvaImage
              image={image}
              width={800}
              height={(image.height / image.width) * 800}
              name="baseImage"
            />
          )}

          {blurMaskEnabled && (
            <Group globalCompositeOperation="source-over">
              <Rect width={800} height={1000} fill="rgba(0,0,0,0.5)" />
              {[...selections, newSelection].filter(Boolean).map((sel, i) => (
                <Rect
                  key={`mask-${i}`}
                  x={sel.x}
                  y={sel.y}
                  width={sel.width}
                  height={sel.height}
                  globalCompositeOperation="destination-out"
                />
              ))}
            </Group>
          )}

          {[...selections, newSelection].filter(Boolean).map((sel) => (
            <React.Fragment key={sel.id || "new"}>
              <Rect
                x={sel.x}
                y={sel.y}
                width={sel.width}
                height={sel.height}
                stroke={selectedId === null && hoveredId === sel.id ? "#00f" : "purple"}
                strokeWidth={selectedId === null && hoveredId === sel.id ? 3 : 2}
                fill="rgba(128, 0, 128, 0.2)"
                onClick={(e) => {
                  if (sel.id) setSelectedId(sel.id);
                  e.cancelBubble = true;
                }}
                onMouseEnter={() => {
                  if (!selectedId && sel.id) setHoveredId(sel.id);
                }}
                onMouseLeave={() => {
                  if (!selectedId) setHoveredId(null);
                }}
                ref={(node) => {
                  if (sel.id) selectionRefs.current[sel.id] = node;
                }}
                draggable={!!sel.id}
                onDragEnd={(e) => {
                  if (sel.id) updateSelection(sel.id, e.target);
                  e.cancelBubble = true;
                }}
                onTransformEnd={(e) => {
                  if (sel.id) updateSelection(sel.id, e.target);
                  e.cancelBubble = true;
                }}
                listening={true}
              />
              {selectedId === sel.id && (
                <Group x={sel.x + sel.width + 10} y={sel.y - 10}>
                  <Rect
                    width={60}
                    height={24}
                    fill="#4CAF50"
                    cornerRadius={4}
                    onClick={() => setSelectedId(null)}
                  />
                  <Text
                    text="Save"
                    fill="#fff"
                    fontSize={14}
                    fontStyle="bold"
                    width={60}
                    height={24}
                    align="center"
                    verticalAlign="middle"
                    onClick={() => setSelectedId(null)}
                  />
                </Group>
              )}
            </React.Fragment>
          ))}

          <Transformer
            ref={trRef}
            rotateEnabled={false}
            enabledAnchors={[
              "top-left",
              "top-right",
              "bottom-left",
              "bottom-right",
              "top-center",
              "bottom-center",
              "middle-left",
              "middle-right",
            ]}
            boundBoxFunc={(oldBox, newBox) => {
              return newBox.width < 5 || newBox.height < 5 ? oldBox : newBox;
            }}
          />
        </Layer>
      </Stage>

      <div style={{ width: 250 }}>
        <h3>Selections</h3>
        {selections.length === 0 && <p>No selections yet.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {selections.map(
            (sel, i) =>
              sel.uri && (
                <div
                  key={`preview-${sel.id}`}
                  style={{
                    border: "2px solid purple",
                    borderRadius: 8,
                    padding: 4,
                    background: "#fff",
                  }}
                >
                  <p style={{ margin: 0 }}>#{i + 1}</p>
                  <img
                    src={sel.uri}
                    alt={`Selection ${i + 1}`}
                    style={{ width: "100%", borderRadius: 4 }}
                  />
                </div>
              )
          )}
        </div>
      </div>
    </div>
  );
}