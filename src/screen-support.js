// Physical screen dimensions keep a landscape phone in the phone layout.
export function forestScreen({width, height, screenWidth=width, screenHeight=height, coarse=false}) {
  const phone=coarse&&Math.min(screenWidth,screenHeight)<600;
  return {phone, rotate:phone&&height>width, compact:coarse&&height<600};
}

export function forestQuality(phone, pixelRatio=1) {
  return {pixelRatio:Math.min(pixelRatio,phone?1.1:1.5), shadowSize:phone?1024:2048,
    foliageDetail:phone?0.55:1, groundDetails:phone?850:1800};
}

export const currentScreen=()=>forestScreen({width:innerWidth,height:innerHeight,
  screenWidth:screen.width,screenHeight:screen.height,coarse:matchMedia('(pointer: coarse)').matches});
