export class TreeSelection {
  constructor() {
    this._selected = new Set();
  }

  get size() {
    return this._selected.size;
  }

  set(nodeId, isDir, childFileIds, checked) {
    if (isDir) {
      childFileIds.forEach((id) =>
        checked ? this._selected.add(id) : this._selected.delete(id),
      );
    } else {
      checked ? this._selected.add(nodeId) : this._selected.delete(nodeId);
    }
  }

  selectAll(fileIds) {
    fileIds.forEach((id) => this._selected.add(id));
  }

  clear() {
    this._selected.clear();
  }

  toArray() {
    return Array.from(this._selected);
  }
}
