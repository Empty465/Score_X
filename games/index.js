const moduleLoads = new Map();

// games/<id>.js 어댑터를 처음 열 때 한 번만 동적으로 불러옵니다. 모듈의 default export가 생명주기({ onLaunch, onShow, onHide })입니다.
export function loadGameModule(id) {
  if (!/^[a-z][a-z0-9_]{1,31}$/.test(id)) {
    return Promise.reject(new Error(`잘못된 게임 ID입니다: ${id}`));
  }

  if (!moduleLoads.has(id)) {
    const moduleUrl = new URL(`/games/${id}.js`, document.baseURI).href;
    moduleLoads.set(id, import(moduleUrl).catch((error) => {
      moduleLoads.delete(id);
      throw error;
    }));
  }
  return moduleLoads.get(id);
}
