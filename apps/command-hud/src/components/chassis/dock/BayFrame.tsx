import React from 'react';
import { useDockSkin } from './DockSkinContext';
import { dockAsset } from './dockSkins';

/**
 * L4 frame overlay for one bay: a 9-slice border image drawn over the bay's
 * edges. Pointer-transparent, so all bay hover/pin behaviour is untouched.
 */
export const BayFrame: React.FC<{ ornament?: boolean }> = ({ ornament }) => {
  const { skin, frameIndex } = useDockSkin();
  if (!skin) return null;
  const kit = skin.frames[frameIndex] ?? skin.frames[0];
  // Bays are 44px tall when collapsed; scale the border to keep the header readable.
  const bw = (slice: number) => Math.round(skin.frameWidth * 0.85 * (slice / 120));
  return (
    <>
      <div
        className="szs-bay-frame"
        aria-hidden="true"
        style={{
          borderImageSource: `url(${dockAsset(kit.src)})`,
          borderImageSlice: `${kit.sliceY} ${kit.sliceX}`,
          borderImageRepeat: kit.repeat,
          borderWidth: `${bw(kit.sliceY)}px ${bw(kit.sliceX)}px`,
        }}
      />
      {ornament && (
        <img
          className="szs-bay-ornament"
          src={dockAsset(skin.ornament.src)}
          alt=""
          aria-hidden="true"
          draggable={false}
          style={{ width: 30 * skin.ornament.ar }}
        />
      )}
    </>
  );
};

/** Bottom conduit strip that runs under the whole dock (L1). */
export const DockConduit: React.FC = () => {
  const { skin } = useDockSkin();
  if (!skin) return null;
  return <div className="szs-conduit" aria-hidden="true" style={{ backgroundImage: `url(${dockAsset(skin.conduit)})` }} />;
};
