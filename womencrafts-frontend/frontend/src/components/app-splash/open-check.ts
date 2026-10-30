/** The welcome appears once per tab, with a hard stop independent of hydration. */
export const OPENED_KEY = "wsa-opened";
export const AWAY_KEY = "wsa-away-since";
export const SPLASH_ATTR = "data-app-splash";

export const OPEN_CHECK = `(function(){try{
if(location.pathname.indexOf("/dev/")===0||/[?&]preview=/.test(location.search))return;
var s=sessionStorage,open=!s.getItem(${JSON.stringify(OPENED_KEY)});
s.setItem(${JSON.stringify(OPENED_KEY)},"1");localStorage.removeItem(${JSON.stringify(AWAY_KEY)});
if(!open||matchMedia("(prefers-reduced-motion: reduce)").matches||(navigator.connection&&navigator.connection.saveData))return;
var root=document.documentElement;
root.setAttribute(${JSON.stringify(SPLASH_ATTR)},"on");
setTimeout(function(){root.removeAttribute(${JSON.stringify(SPLASH_ATTR)});},1000);
}catch(e){}})();`;
