import './App.css';
import { Vector3 } from 'three'
import { useEffect, useMemo, useRef, useState } from 'react';

interface Point {
  x: number;
  y: number;
}

interface Segment {
  start: Point;
  end: Point;
}

type Polygon = Point[];

const isPositive = (p1: Point, p2: Point, pi: Point) => { // all parameters are THREE.Vector3()
  const vp1 = new Vector3(p1.x, p1.y, 0);;
  const v1 = new Vector3(p2.x, p2.y, 0).sub(vp1);
  const v2 = new Vector3(pi.x, pi.y, 0).sub(vp1);
  return v1.dot(v2) >= 0;
}

const lineIntersection = (s0: Segment, s1: Segment) => {
  const A = s0.start;
  const B = s0.end;
  const C = s1.start;
  const D = s1.end;

  // Line AB represented as a1x + b1y = c1 
  const a1 = B.y - A.y;
  const b1 = A.x - B.x;
  const c1 = a1 * (A.x) + b1 * (A.y);

  // Line CD represented as a2x + b2y = c2 
  const a2 = D.y - C.y;
  const b2 = C.x - D.x;
  const c2 = a2 * (C.x) + b2 * (C.y);

  const determinant = a1 * b2 - a2 * b1;

  if (determinant === 0) {
    return;
  }
  else {
    const x = (b2 * c1 - b1 * c2) / determinant;
    const y = (a1 * c2 - a2 * c1) / determinant;

    const line1res = isPositive(A, B, { x, y }) && isPositive(B, A, { x, y });
    const line2res = isPositive(C, D, { x, y }) && isPositive(D, C, { x, y });
    if (line1res && line2res) {
      return { x, y };
    }
  }
}

const intersectSegmentPolygon = (seg: Segment, _poly: Polygon): Point[] => {
  if (_poly.length === 0) {
    return [];
  }
  const poly = Array.from(_poly);
  poly.push(poly[0]);
  const ret: Point[] = [];
  for (let i = 1; i < poly.length; i++) {
    const p0 = poly[i - 1];
    const p1 = poly[i];
    const intersection = lineIntersection(seg, { start: p0, end: p1 });
    if (intersection) {
      if (ret.filter(r => r.x === intersection.x && r.y === intersection.y).length === 0) {
        ret.push(intersection);
      }
    }
  }

  return ret;
}

const findConvex = (_poly: Polygon) => {
  if (_poly.length < 3) {
    return [];
  }
  const ret = [];
  const poly = Array.from(_poly);
  poly.push(poly[0]);
  poly.push(poly[1]);

  for (let i = 1; i < poly.length - 1; i++) {
    const p0 = poly[i - 1];
    const p1 = poly[i];
    const p2 = poly[i + 1];

    const vp0 = new Vector3(p0.x, p0.y);
    const vp1 = new Vector3(p1.x, p1.y);
    const vp2 = new Vector3(p2.x, p2.y);

    vp1.sub(vp0);
    vp2.sub(vp0);
    if (vp1.cross(vp2).z >= 0) {
      ret.push(p1);
    }
  }
  return ret;
}

interface Route {
  point?: Point;
  children?: Route[];
}

const findPath = (obstacles: Polygon[], orig: Point, dest: Point, candidates: Point[] = [], current: Route = {}, depth: number = 0) => {
  current.point = orig;
  let concaves: Point[] = [];
  const directToEnd = obstacles.map(ob => {
    const directSeg = { start: orig, end: dest };
    const intersection = intersectSegmentPolygon(directSeg, ob);
    return ((intersection.length === 1 && intersection[0].x === orig.x && intersection[0].y === orig.y) || intersection.length === 0);
  }).reduce((a, b) => a && b);
  if (directToEnd) {
    current.children = [{ point: dest }]
    return;
  }
  for (let i = 0; i < obstacles.length; i++) {
    let myConcaves = findConvex(obstacles[i])
      .flatMap(pt => [
        { x: pt.x - 1, y: pt.y - 1 },
        { x: pt.x - 1, y: pt.y },
        { x: pt.x - 1, y: pt.y + 1 },
        { x: pt.x, y: pt.y - 1 },
        { x: pt.x, y: pt.y + 1 },
        { x: pt.x + 1, y: pt.y - 1 },
        { x: pt.x + 1, y: pt.y },
        { x: pt.x + 1, y: pt.y + 1 },
      ])
      .filter(pt => pt.x >= 0 && pt.y >= 0)
      .filter(c => !(c.x === orig.x && c.y === orig.y));

    concaves = [...concaves, ...myConcaves]
  }
  const directApexes = concaves.filter(c => {
    const seg = { start: orig, end: c };
    for (let j = 0; j < obstacles.length; j++) {
      const intersections = intersectSegmentPolygon(seg, obstacles[j]);
      if (intersections.length === 0) {
        continue;
      }
      return false;
    }
    return true;
  });

  const validateApexes = directApexes.filter(a => candidates.filter(c => c.x === a.x && c.y === a.y).length === 0);
  current.children = Array.from(Array(validateApexes.length));
  for (let i = 0; i < current.children.length; i++) {
    current.children[i] = {}
  }
  validateApexes.map((a, idx) => findPath(obstacles, a, dest, [...directApexes, ...candidates], current.children![idx], depth + 1));

}

const extractRoutes = (route: Route, out: Point[][] = [], cur: Point[] = []) => {
  if (route.point) {
    cur.push(route.point)
    if (route.children && route.children.length > 0) {
      for (let i = 0; i < route.children.length; i++) {
        const tmp = Array.from(cur)
        extractRoutes(route.children[i], out, cur);
        out.push(cur);
        cur = tmp;
      }
    }
  }
}

const distanceToLine = (p1: Point, p2: Point, pt: Point) => {
  const a = p1.y - p2.y;
  const b = p2.x - p1.x;
  return Math.abs(a * pt.x + b * pt.y + p1.x * p2.y - p2.x * p1.y) / Math.sqrt(a * a + b * b);
}

const distance = (a: Point, b: Point) => {
  return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2))
}

const selectPath = (paths: Point[][], dst: Point): Point[] => {
  if (paths.length === 0) {
    return []
  }
  return paths.filter(p => p[p.length - 1].x === dst.x && p[p.length - 1].y === dst.y)
    .map(p => ({ distance: p.reduce((a, b, idx, arr) => a + (idx === 0 ? 0 : distance(arr[idx - 1], b)), 0), path: p }))
    .sort((a, b) => a.distance - b.distance)
    .map(a => a.path)[0] || [];
}

const App = () => {
  const obstacles: Polygon[] = useMemo(() => [
    [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 15 },
      { x: 1, y: 15 },
    ],
    [
      { x: 0, y: 17 },
      { x: 20, y: 17 },
      { x: 20, y: 19 },
      { x: 0, y: 19 },
    ],
    [
      { x: 5, y: 0 },
      { x: 60, y: 0 },
      { x: 60, y: 14 },
      { x: 5, y: 14 },
    ],
    [
      { x: 24, y: 16 },
      { x: 60, y: 16 },
      { x: 60, y: 24 },
      { x: 24, y: 24 },
    ]
  ], []);

  const [start, setStart] = useState({ x: 0, y: 0 });
  const [end, setEnd] = useState({ x: 20, y: 20 });
  const onStart = useRef(false);
  const onEnd = useRef(false);

  const maxX = 50;
  const maxY = 50;
  const blockSize = 10;

  const route: Route = {}
  findPath(obstacles, start, end, [], route);

  const paths: Point[][] = [];
  extractRoutes(route, paths);
  const bestPath = selectPath(paths, end);

  // console.log('path: ');
  // console.log(paths);
  // console.log('bestPath: ');
  // console.log(bestPath);

  const getMouseDownPos = (e: MouseEvent) => {
    const ele = document.elementFromPoint(e.clientX, e.clientY);
    if (!ele) {
      return;
    }
    if (ele.className !== 'block-item') {
      return;
    }
    if (!ele.parentElement) {
      return;
    }
    if (!ele.parentElement.parentElement) {
      return;
    }
    const x = Array.from(ele.parentElement.children).indexOf(ele);
    const y = Array.from(ele.parentElement.parentElement.children).indexOf(ele.parentElement);
    return { x, y };
  }

  const setPos = (e: MouseEvent) => {
    const pos = getMouseDownPos(e);
    if (!pos) {
      return;
    }
    if (onStart.current) {
      setStart(pos);
    }
    else if (onEnd.current) {
      setEnd(pos);
    }
  }
  const captureCurrent = (e: MouseEvent) => {
    const pos = getMouseDownPos(e);
    if (!pos) {
      return;
    }
    if (!onStart.current && isStart(pos.x, pos.y)) {
      onStart.current = true;
      return;
    }
    else if (!onEnd.current && isEnd(pos.x, pos.y)) {
      onEnd.current = true;
      return;
    }
  }
  const releaseCurrent = () => {
    onStart.current = false;
    onEnd.current = false;
  }

  useEffect(() => {
    document.addEventListener('mousedown', captureCurrent);
    document.addEventListener('mousemove', setPos);
    document.addEventListener('mouseup', releaseCurrent);
    return () => {
      document.removeEventListener('mousedown', captureCurrent);
      document.removeEventListener('mousemove', setPos);
      document.removeEventListener('mouseup', releaseCurrent);
    }
  })

  const isApex = (x: number, y: number) => {

    for (let i = 0; i < obstacles.length; i++) {
      for (let j = 0; j < obstacles[i].length; j++) {
        if (obstacles[i][j].x === x && obstacles[i][j].y === y) {
          return true;
        }
      }
    }
    return false;
  }

  const inPolygon = (pt: Point, poly_: Polygon): boolean => {
    const poly = Array.from(poly_);
    poly.push(poly[0]);
    for (let i = 1; i < poly.length; i++) {
      const a = poly[i - 1];
      const b = poly[i];
      const va = new Vector3(a.x, a.y);
      const vb = new Vector3(b.x, b.y);
      const vp = new Vector3(pt.x, pt.y);
      vb.sub(va);
      vp.sub(va);
      if (vb.cross(vp).z < 0) {
        return false;
      }
    }
    return true;
  }

  const isObstacle = (x: number, y: number): boolean => {
    return obstacles.map((p) => inPolygon({ x, y }, p)).reduce((a, b) => a || b);
  }

  const isStart = (x: number, y: number) => {
    return x === start.x && y === start.y;
  }

  const isEnd = (x: number, y: number) => {
    return x === end.x && y === end.y;
  }

  const onLine = (x: number, y: number) => {
    const pt = { x, y };
    const _path = Array.from(bestPath);
    for (let i = 1; i < _path.length; i++) {
      const p0 = _path[i - 1];
      const p1 = _path[i];
      if (Math.round(distanceToLine(p0, p1, pt)) === 0) {
        if (isPositive(p0, p1, pt) && isPositive(p1, p0, pt)) {
          return true;
        }
      }
    }
    return false;
  }

  const getColor = (x: number, y: number) => {
    if (isStart(x, y)) {
      return 'lightblue';
    }
    else if (isEnd(x, y)) {
      return 'pink';
    }
    else if (isApex(x, y)) {
      return 'red';
    }
    else if (isObstacle(x, y)) {
      return 'black';
    }
    else if (onLine(x, y)) {
      return 'green'
    }
    return 'transparent'
  }

  return (
    <div className="App">
      {
        Array.from(Array(maxY)).map((_, y) =>
          <div key={`${y}-row`} className='block-item-row'>
            {Array.from(Array(maxX)).map((_, x) =>
              <div
                className='block-item'
                key={`${x}-${y}`}
                style={{
                  width: blockSize,
                  height: blockSize,
                  position: 'absolute',
                  top: y * blockSize,
                  left: x * blockSize,
                  background: getColor(x, y)
                }}></div>)
            }
          </div>
        )
      }
    </div>
  );
}

export default App;
