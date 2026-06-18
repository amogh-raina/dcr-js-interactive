import { isPrimaryButton } from 'diagram-js/lib/util/Mouse';
import { toPoint } from 'diagram-js/lib/util/Event';
import { isAny } from '../modeling/util/ModelingUtil';

const EDGE_DRAG_SIZE = 14;
const QUICK_CONNECT_MARKER = 'dcr-quick-connect-source';

export default function QuickConnect(eventBus, canvas, connect) {
  let markedElement = null;

  function clearMarker() {
    if (markedElement) {
      canvas.removeMarker(markedElement, QUICK_CONNECT_MARKER);
      markedElement = null;
    }
  }

  function markElement(element) {
    if (markedElement === element) {
      return;
    }

    clearMarker();
    markedElement = element;
    canvas.addMarker(element, QUICK_CONNECT_MARKER);
  }

  eventBus.on('element.mousemove', 1500, function(event) {
    const element = event.element;

    if (!isConnectableSource(element) || !isNearEdge(event, element, canvas)) {
      clearMarker();
      return;
    }

    markElement(element);
  });

  eventBus.on([
    'element.out',
    'connect.cleanup',
    'connect.ended',
    'connect.canceled'
  ], clearMarker);

  eventBus.on('element.mousedown', 1500, function(event) {
    const originalEvent = event.originalEvent;
    const element = event.element;

    if (!isPrimaryButton(event) || !isConnectableSource(element)) {
      return;
    }

    const startPosition = toLocalPoint(originalEvent, canvas);

    if (!startPosition || !isNearElementEdge(startPosition, element, canvas)) {
      return;
    }

    clearMarker();
    connect.start(originalEvent, element, startPosition);

    return false;
  });
}

QuickConnect.$inject = [
  'eventBus',
  'canvas',
  'connect'
];

function isConnectableSource(element) {
  return isAny(element, ['dcr:Event', 'dcr:Nesting', 'dcr:SubProcess']);
}

function isNearEdge(event, element, canvas) {
  const position = toLocalPoint(event.originalEvent, canvas);

  return !!position && isNearElementEdge(position, element, canvas);
}

function isNearElementEdge(position, element, canvas) {
  if (
    typeof element.x !== 'number' ||
    typeof element.y !== 'number' ||
    typeof element.width !== 'number' ||
    typeof element.height !== 'number'
  ) {
    return false;
  }

  const edgeSize = EDGE_DRAG_SIZE / canvas.viewbox().scale;
  const insideHorizontal = position.x >= element.x && position.x <= element.x + element.width;
  const insideVertical = position.y >= element.y && position.y <= element.y + element.height;

  if (!insideHorizontal || !insideVertical) {
    return false;
  }

  return Math.min(
    position.x - element.x,
    element.x + element.width - position.x,
    position.y - element.y,
    element.y + element.height - position.y
  ) <= edgeSize;
}

function toLocalPoint(event, canvas) {
  const globalPosition = toPoint(event);

  if (!globalPosition) {
    return null;
  }

  const viewbox = canvas.viewbox();
  const clientRect = canvas._container.getBoundingClientRect();

  return {
    x: viewbox.x + (globalPosition.x - clientRect.left) / viewbox.scale,
    y: viewbox.y + (globalPosition.y - clientRect.top) / viewbox.scale
  };
}
