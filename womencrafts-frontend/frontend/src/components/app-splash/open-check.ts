/**
 * The splash decides BEFORE first paint whether this is an "app open", so she
 * never sees a page flash before it, and ordinary loads never flash it.
 *
 * Its own plain module on purpose: the root layout is a server component and
 * inlines this into a script. Imported from a "use client" module it would
 * arrive as a client reference, not a string.
 *
 * An app open is:
 *  - a new launch — a new tab, or the installed app started fresh (its
 *    sessionStorage is new), or
 *  - coming back after AWAY_MINUTES or more with the app out of sight.
 * Moving between pages, reloading, or signing in or out is not an open.
 */
export const AWAY_MINUTES = 30;

export const OPENED_KEY = "wsa-opened";
export const AWAY_KEY = "wsa-away-since";
export const SPLASH_ATTR = "data-app-splash";

export const OPEN_CHECK = `(function(){try{
var p=location.pathname,q=location.search;
if(p.indexOf("/dev/")===0||/[?&]preview=/.test(q))return;
var s=sessionStorage,l=localStorage,now=Date.now(),away=+(l.getItem(${JSON.stringify(AWAY_KEY)})||0);
var open=!s.getItem(${JSON.stringify(OPENED_KEY)})||(away>0&&now-away>=${AWAY_MINUTES * 60_000});
s.setItem(${JSON.stringify(OPENED_KEY)},"1");l.removeItem(${JSON.stringify(AWAY_KEY)});
if(!open)return;
document.documentElement.setAttribute(${JSON.stringify(SPLASH_ATTR)},"on");
var v=document.getElementById("app-splash-video");if(v){var r=v.play();if(r&&r.catch)r.catch(function(){});}
}catch(e){}})();`;
