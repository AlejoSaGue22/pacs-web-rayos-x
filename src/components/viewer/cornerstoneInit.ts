import * as cornerstone from '@cornerstonejs/core';
import * as cornerstoneTools from '@cornerstonejs/tools';
import cornerstoneDICOMImageLoader from '@cornerstonejs/dicom-image-loader';

const { RenderingEngine, Enums: csEnums } = cornerstone;
const {
  ToolGroupManager,
  PanTool,
  ZoomTool,
  WindowLevelTool,
  LengthTool,
  AngleTool,
  RectangleROITool,
  StackScrollTool,
  Enums: csToolsEnums,
} = cornerstoneTools;

const { MouseBindings } = csToolsEnums;

let initialized = false;
let renderingEngine: InstanceType<typeof RenderingEngine> | null = null;
let toolGroup: ReturnType<typeof ToolGroupManager.createToolGroup> | null = null;

const RENDERING_ENGINE_ID = 'miniPacsRenderingEngine';
const TOOL_GROUP_ID = 'miniPacsToolGroup';

export const TOOL_NAMES = {
  WindowLevel: WindowLevelTool.toolName,
  Pan: PanTool.toolName,
  Zoom: ZoomTool.toolName,
  Length: LengthTool.toolName,
  Angle: AngleTool.toolName,
  RectangleROI: RectangleROITool.toolName,
} as const;

export function initCornerstone() {
  if (initialized) return;

  cornerstone.init();
  cornerstoneTools.init();

  cornerstoneDICOMImageLoader.init();
  cornerstoneDICOMImageLoader.wadouri.register({});

  renderingEngine = new RenderingEngine(RENDERING_ENGINE_ID);

  const tools = [
    PanTool,
    ZoomTool,
    WindowLevelTool,
    LengthTool,
    AngleTool,
    RectangleROITool,
    StackScrollTool,
  ];

  tools.forEach(tool => cornerstoneTools.addTool(tool));

  toolGroup = ToolGroupManager.createToolGroup(TOOL_GROUP_ID);

  toolGroup.addTool(PanTool.toolName);
  toolGroup.addTool(ZoomTool.toolName);
  toolGroup.addTool(WindowLevelTool.toolName);
  toolGroup.addTool(LengthTool.toolName);
  toolGroup.addTool(AngleTool.toolName);
  toolGroup.addTool(RectangleROITool.toolName);
  toolGroup.addTool(StackScrollTool.toolName);

  toolGroup.setToolActive(WindowLevelTool.toolName, {
    bindings: [{ mouseButton: MouseBindings.Primary }],
  });
  toolGroup.setToolActive(PanTool.toolName, {
    bindings: [{ mouseButton: MouseBindings.Auxiliary }],
  });
  toolGroup.setToolActive(ZoomTool.toolName, {
    bindings: [{ mouseButton: MouseBindings.Secondary }],
  });
  toolGroup.setToolActive(StackScrollTool.toolName);

  toolGroup.setToolPassive(LengthTool.toolName);
  toolGroup.setToolPassive(AngleTool.toolName);
  toolGroup.setToolPassive(RectangleROITool.toolName);

  initialized = true;
}

export function getRenderingEngine() {
  return renderingEngine;
}

export function getToolGroup() {
  return toolGroup;
}

export function setToolActive(toolName: string) {
  if (!toolGroup) return;

  toolGroup.setToolPassive(WindowLevelTool.toolName);
  toolGroup.setToolPassive(PanTool.toolName);
  toolGroup.setToolPassive(ZoomTool.toolName);
  toolGroup.setToolPassive(LengthTool.toolName);
  toolGroup.setToolPassive(AngleTool.toolName);
  toolGroup.setToolPassive(RectangleROITool.toolName);

  if (toolName === WindowLevelTool.toolName) {
    toolGroup.setToolActive(toolName, {
      bindings: [{ mouseButton: MouseBindings.Primary }],
    });
  } else if (toolName === PanTool.toolName) {
    toolGroup.setToolActive(toolName, {
      bindings: [{ mouseButton: MouseBindings.Primary }],
    });
  } else if (toolName === ZoomTool.toolName) {
    toolGroup.setToolActive(toolName, {
      bindings: [{ mouseButton: MouseBindings.Primary }],
    });
  } else {
    toolGroup.setToolActive(toolName, {
      bindings: [{ mouseButton: MouseBindings.Primary }],
    });
    toolGroup.setToolActive(WindowLevelTool.toolName, {
      bindings: [{ mouseButton: MouseBindings.Auxiliary }],
    });
  }
}

export function applyWindowLevelPreset(viewportId: string, windowCenter: number, windowWidth: number) {
  if (!renderingEngine) return;
  const viewport = renderingEngine.getViewport(viewportId);
  if (!viewport) return;

  const stackViewport = viewport as cornerstone.Types.IStackViewport;
  if (stackViewport.setProperties) {
    stackViewport.setProperties({
      voiRange: {
        lower: windowCenter - windowWidth / 2,
        upper: windowCenter + windowWidth / 2,
      },
    });
    stackViewport.render();
  }
}

export function resetViewport(viewportId: string) {
  if (!renderingEngine) return;
  const viewport = renderingEngine.getViewport(viewportId);
  if (!viewport) return;

  viewport.resetCamera();
  viewport.render();
}

export function invertViewport(viewportId: string, inverted: boolean) {
  if (!renderingEngine) return;
  const viewport = renderingEngine.getViewport(viewportId);
  if (!viewport) return;

  const stackViewport = viewport as cornerstone.Types.IStackViewport;
  if (stackViewport.setProperties) {
    stackViewport.setProperties({ invert: inverted });
    stackViewport.render();
  }
}

export function destroyCornerstone() {
  if (renderingEngine) {
    renderingEngine.destroy();
    renderingEngine = null;
  }
  if (toolGroup) {
    ToolGroupManager.destroyToolGroup(TOOL_GROUP_ID);
    toolGroup = null;
  }
  initialized = false;
}
