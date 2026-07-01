import React, { useState, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import data from './countries.json' with { type: 'json' };

// ==========================================
// 1. MOCK GEOJSON DATA
// Replace this array with the `features` array from your Mapshaper GeoJSON file!
// ==========================================
const mockGeoJSON = [
  {
    type: 'Feature',
    properties: { ISO_A3: 'USA', ADMIN: 'United States' },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-125, 48], [-65, 45], [-80, 25], [-100, 25], [-120, 30], [-125, 48]
      ]]
    }
  },
  {
    type: 'Feature',
    properties: { ISO_A3: 'ITA', ADMIN: 'Italy' },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [8, 45], [14, 46], [18, 40], [15, 38], [11, 42], [8, 45]
      ]]
    }
  },
  {
    type: 'Feature',
    properties: { ISO_A3: 'JPN', ADMIN: 'Japan' },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [130, 31], [140, 35], [145, 43], [140, 45], [135, 38], [130, 31]
      ]]
    }
  }
];

// GLOBE CONSTANTS
const GLOBE_RADIUS = 5;
const EXTRUSION_DEPTH = 0.3; // How high the countries stick up
const OCEAN_COLOR = "#296fe9";
const DEFAULT_COUNTRY_COLOR = "#2eff97"; // Gray
const SELECTED_COLOR = "#f59e0b"; // Amber

const CountryMesh = ({ feature, isSelected, onClick }) => {
  const meshRef = useRef();
  
  // useMemo ensures we only calculate this heavy geometry math once per country
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    const coords = feature.geometry.coordinates[0]; 
    
    coords.forEach((point, index) => {
      const [lon, lat] = point;
      if (index === 0) shape.moveTo(lon, lat);
      else shape.lineTo(lon, lat);
    });

    let geo = new THREE.ExtrudeGeometry(shape, {
      depth: EXTRUSION_DEPTH,
      bevelEnabled: false, 
    });

    // Crucial for Low Poly: Separate shared vertices so edges remain sharp
    geo = geo.toNonIndexed();

    const posAttribute = geo.attributes.position;
    const v = new THREE.Vector3();
    
    for (let i = 0; i < posAttribute.count; i++) {
      const lon = posAttribute.getX(i);
      const lat = posAttribute.getY(i);
      const zOffset = posAttribute.getZ(i);

      // Spherical coordinate math
      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lon + 180) * (Math.PI / 180);
      const radius = GLOBE_RADIUS + zOffset;

      v.x = -(radius * Math.sin(phi) * Math.cos(theta));
      v.z = (radius * Math.sin(phi) * Math.sin(theta));
      v.y = (radius * Math.cos(phi));

      posAttribute.setXYZ(i, v.x, v.y, v.z);
    }

    geo.computeVertexNormals();
    return geo;
  }, [feature]);


  // // Push out country when selected
  // useFrame(() => {
  //   if (isSelected && meshRef.current) {
  //     meshRef.current.position.y = .5;
  //   } else if (meshRef.current) {
  //     meshRef.current.position.y = 0;
  //   }
  // });


  return (
    <mesh 
      ref={meshRef}
      geometry={geometry} 
      onClick={(e) => {
        e.stopPropagation(); // Prevent clicking through to the ocean
        onClick(feature.properties.NAME_ID);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'default';
      }}
    >
      <meshStandardMaterial 
        color={isSelected ? SELECTED_COLOR : DEFAULT_COUNTRY_COLOR} 
        flatShading={true}
        roughness={0.7} // TODO: check
      />
    </mesh>
  );
};


// Light that follows camera
const CameraLight = ({ intensity = 1.5 }) => {
  const lightRef = useRef();
  // We use a memoized vector to avoid creating a new object 60 times a second
  const offsetVector = useMemo(() => new THREE.Vector3(), []);
  
  useFrame(({ camera }) => {
    if (lightRef.current) {
      // 1. Get the current camera position
      offsetVector.copy(camera.position);
      
      // 2. Rotate the light's position 45 degrees to the right (Y axis)
      offsetVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4);
      
      // 3. Rotate it slightly upwards (X axis) for depth
      offsetVector.applyAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 8);
      
      // 4. Apply this new "over the shoulder" position to the light
      lightRef.current.position.copy(offsetVector);
    }
  });

  return <directionalLight ref={lightRef} intensity={intensity} />;
};


// Globe
export function LowPolyGlobe({ 
  geoData = data.features,
  onCountrySelect,
  
  // Rotation configuration
  autoRotate = true,
  autoRotateSpeed = 0.5,

  // Lighting configuration
  ambientLightIntensity = 1,
  cameraLightIntensity = 1,
}) {
  const [selectedIso, setSelectedIso] = useState(null);

  const handleCountryClick = (iso) => {
    setSelectedIso(iso);
    if (onCountrySelect) {
      onCountrySelect(iso);
    }
  };
  const handleOceanClick = () => {
    setSelectedIso(null);
    if (onCountrySelect) {
      onCountrySelect(null);
    }
  };



  return (
    <Canvas camera={{ position: [0, 0, 15], fov: 45 }}>
        
        {/* Lighting setup */}
        <ambientLight intensity={ambientLightIntensity} />
        <CameraLight intensity={cameraLightIntensity} />
        
        

        {/* Spin controls */}
        <OrbitControls 
          enablePan={false} 
          minDistance={8} 
          maxDistance={25}
          autoRotate={autoRotate}
          autoRotateSpeed={autoRotateSpeed}
        />



        {/* Rendering of world*/}
        <group>
          {/* Base Ocean Sphere */}
          <mesh onClick={handleOceanClick}>
            <sphereGeometry args={[GLOBE_RADIUS, 32, 32]} />
            <meshStandardMaterial color={OCEAN_COLOR} roughness={0.8} />
          </mesh>


          {/* Render Country Polygons */}
          {geoData.map((feature, i) => {
            const iso = feature.properties.NAME_ID;
            return (
              <CountryMesh 
                key={iso + i} 
                feature={feature} 
                isSelected={selectedIso === iso}
                onClick={handleCountryClick}
              />
            );
          })}
        </group>
      </Canvas>
  );
}

// ==========================================
// 4. MAIN APP (For testing the component)
// ==========================================
export default function App() {
  return (
    <div>
      <LowPolyGlobe 
        autoRotateSpeed={0.8} // Easily adjust spin speed here
        onCountrySelect={(iso) => console.log("Selected country:", iso)}
      />
    </div>
  );
}