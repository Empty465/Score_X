const moduleLoads = new Map();

export function loadGameModule(modulePath) {
  if (!/^\.\/games\/[a-z0-9-]+\.js$/.test(modulePath)) {
    return Promise.reject(new Error(`잘못된 게임 모듈 경로입니다: ${modulePath}`));
  }

  if (!moduleLoads.has(modulePath)) {
    const moduleUrl = new URL(modulePath, document.baseURI).href;
    moduleLoads.set(modulePath, import(moduleUrl).catch((error) => {
      moduleLoads.delete(modulePath);
      throw error;
    }));
  }
  return moduleLoads.get(modulePath);
}
