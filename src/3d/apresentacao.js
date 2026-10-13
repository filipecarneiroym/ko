import {Vector3} from '@babylonjs/core/Maths/math.vector.js';
import {Color3,Color4} from '@babylonjs/core/Maths/math.color.js';
import {HemisphericLight} from '@babylonjs/core/Lights/hemisphericLight.js';
import {DirectionalLight} from '@babylonjs/core/Lights/directionalLight.js';
import {ShadowGenerator} from '@babylonjs/core/Lights/Shadows/shadowGenerator.js';
import '@babylonjs/core/Rendering/outlineRenderer.js';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder.js';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial.js';
import {ImageProcessingConfiguration} from '@babylonjs/core/Materials/imageProcessingConfiguration.js';

// A mesma luz é usada no laboratório e nas prévias dos ativos reais.
export function criarApresentacao(scene) {
  scene.clearColor=new Color4(.025,.032,.052,1);
  scene.imageProcessingConfiguration.contrast=1.12;
  scene.imageProcessingConfiguration.exposure=1.05;
  scene.imageProcessingConfiguration.toneMappingEnabled=true;
  scene.imageProcessingConfiguration.toneMappingType=ImageProcessingConfiguration.TONEMAPPING_ACES;
  const ambiente=new HemisphericLight('preenchimento',new Vector3(0,1,0),scene);
  ambiente.intensity=.55;
  ambiente.diffuse=new Color3(.88,.90,1);
  ambiente.groundColor=new Color3(.15,.12,.20);
  const principal=new DirectionalLight('luz-quente',new Vector3(-.6,-1,.55),scene);
  principal.position.set(5,8,-5);
  principal.diffuse=new Color3(1,.86,.71);
  principal.intensity=2.1;
  principal.shadowMinZ=.1;principal.shadowMaxZ=25;
  // Volume fixo: substituir Pipoca não altera a sombra do outro lutador.
  principal.autoUpdateExtends=false;
  principal.orthoLeft=-13;principal.orthoRight=13;
  principal.orthoBottom=-10;principal.orthoTop=10;
  const recorte=new DirectionalLight('recorte-violeta',new Vector3(.5,-.3,-1),scene);
  recorte.diffuse=new Color3(.49,.46,1);
  recorte.intensity=1.35;
  const sombras=new ShadowGenerator(1024,principal);
  sombras.usePercentageCloserFiltering=true;
  sombras.filteringQuality=ShadowGenerator.QUALITY_LOW;
  sombras.bias=.0005;sombras.normalBias=.008;
  sombras.setDarkness(.3);

  const piso=MeshBuilder.CreateGround('piso',{width:22,height:12},scene);
  const tinta=new StandardMaterial('piso-grafite',scene);
  tinta.diffuseColor=Color3.FromHexString('#242c3f');
  tinta.specularColor=new Color3(.07,.07,.09);
  piso.material=tinta;piso.receiveShadows=true;
  const borda=MeshBuilder.CreateLines('limite-arena',{points:[
    new Vector3(-7.8,.002,-2.5),new Vector3(7.8,.002,-2.5),
    new Vector3(7.8,.002,3),new Vector3(-7.8,.002,3),new Vector3(-7.8,.002,-2.5),
  ]},scene);
  borda.color=Color3.FromHexString('#62708b');borda.alpha=.4;
  const preparados=new WeakSet();
  let encerrado=false;
  scene.onDisposeObservable.addOnce(()=>{encerrado=true;});
  return {
    projetarSombra(malha) { sombras.addShadowCaster(malha,false); },
    prepararModelo(modelo) {
      for(const malha of modelo.malhas||[]) {
        if(preparados.has(malha))continue;
        preparados.add(malha);
        sombras.addShadowCaster(malha,false);
        // Reservar o mapa de 1024px ao contato no piso evita acne no rosto
        // e nas orelhas finas. O volume do personagem vem das três luzes PBR.
        malha.receiveShadows=false;
        malha.onDisposeObservable.addOnce(()=>{if(!encerrado)sombras.removeShadowCaster(malha,false);});
        const m=malha.material;
        if(!m?.name?.startsWith('pipoca_'))continue;
        // A casca de profundidade do contorno ocultaria íris e acabamentos
        // projetados sobre pele/roupa. Reservar o traço às luvas volumosas.
        if(/luvas/.test(m.name)) {
          malha.renderOutline=true;
          malha.outlineWidth=.007;
          malha.outlineColor=new Color3(.075,.045,.065);
        }
        if(m.name.includes('pelo')) {
          m.roughness=.88;
          m.metallic=0;
          if(m.bumpTexture)m.bumpTexture.level=1.5;
        } else if(m.name.includes('tecido')) {
          m.roughness=.52;
          if(m.sheen){m.sheen.isEnabled=true;m.sheen.intensity=.18;m.sheen.color=new Color3(.34,.38,.75);}
        } else if(m.name.includes('luvas')) {
          m.roughness=.32;
          if(m.clearCoat){m.clearCoat.isEnabled=true;m.clearCoat.intensity=.22;m.clearCoat.roughness=.3;}
        }
      }
    },
  };
}
