"""Prepara um blockout GLB em processo isolado do Blender 5.2.

Uso (PowerShell; não abre janela nem modifica uma sessão existente):
  & 'C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe' `
    --background --factory-startup --python-exit-code 1 `
    --python scripts/producao-3d/preparar-blender.py -- `
    --glb public/modelos/blockout/pipoca-v1.glb `
    --saida art/premium/modelos-3d/blockout `
    --referencia art/premium/modelos-3d/referencias/pipoca-referencia-v1.png

Saída: <nome>.blend editável e <nome>-{3-4,frente,perfil}.png, em repouso.
A malha, o rig, os materiais e todas as ações importadas são preservados.
A referência opcional fica incorporada e oculta nos renders. O estúdio QA é
uma coleção independente; os arquivos representam blockouts, não arte final.
Frente = +X do GLB. O importador converte +Y para o eixo vertical +Z do Blender.
"""

import argparse
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector


def argumentos():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--glb", required=True, type=Path)
    parser.add_argument("--saida", required=True, type=Path)
    parser.add_argument("--referencia", type=Path)
    resultado = parser.parse_args(args)
    resultado.glb = resultado.glb.resolve(strict=True)
    if resultado.glb.suffix.lower() != ".glb":
        parser.error("--glb precisa apontar para um arquivo GLB.")
    resultado.saida = resultado.saida.resolve()
    if resultado.referencia:
        resultado.referencia = resultado.referencia.resolve(strict=True)
        if resultado.referencia.suffix.lower() != ".png":
            parser.error("--referencia precisa apontar para um PNG.")
    return resultado


def objeto(colecao, nome, dados=None):
    novo = bpy.data.objects.new(nome, dados)
    colecao.objects.link(novo)
    return novo


def apontar(item, alvo):
    item.rotation_euler = (alvo - item.location).to_track_quat("-Z", "Y").to_euler()


def luz(colecao, nome, posicao, alvo, energia, tamanho, cor):
    dados = bpy.data.lights.new(nome, type="AREA")
    dados.energy = energia
    dados.shape = "DISK"
    dados.size = tamanho
    dados.color = cor
    item = objeto(colecao, nome, dados)
    item.location = posicao
    apontar(item, alvo)
    return item


def camera(colecao, nome, direcao, alvo, altura, cantos, proporcao):
    dados = bpy.data.cameras.new(nome)
    dados.type = "ORTHO"
    dados.lens = 70
    dados.clip_start = 0.01
    dados.clip_end = max(100, altura * 100)
    item = objeto(colecao, nome, dados)
    item.location = alvo + Vector(direcao).normalized() * altura * 6
    apontar(item, alvo)
    inversa = item.rotation_euler.to_quaternion().inverted()
    projetados = [inversa @ (canto - alvo) for canto in cantos]
    largura = max(p.x for p in projetados) - min(p.x for p in projetados)
    vertical = max(p.y for p in projetados) - min(p.y for p in projetados)
    dados.ortho_scale = max(vertical, largura / proporcao) * 1.18
    return item


def chao(colecao, centro, altura, minimo_z):
    raio = altura * 8
    malha = bpy.data.meshes.new("QA_Chao")
    malha.from_pydata([(-raio, -raio, 0), (raio, -raio, 0),
                      (raio, raio, 0), (-raio, raio, 0)], [], [(0, 1, 2, 3)])
    malha.update()
    item = objeto(colecao, "QA_Chao", malha)
    item.location = (centro.x, centro.y, minimo_z - altura * 0.008)
    material = bpy.data.materials.new("QA_MaterialChao")
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (0.022, 0.028, 0.045, 1)
    shader.inputs["Roughness"].default_value = 0.8
    item.data.materials.append(material)


def referencia(colecao, caminho, centro, altura):
    imagem = bpy.data.images.load(str(caminho), check_existing=True)
    imagem.pack()
    imagem.use_fake_user = True
    item = objeto(colecao, "QA_Referencia_arte_aprovada")
    item.empty_display_type = "IMAGE"
    item.empty_display_size = altura
    item.data = imagem
    item.empty_image_depth = "BACK"
    item.location = (centro.x, centro.y + altura * 1.4, centro.z)
    item.rotation_euler = (math.pi / 2, 0, 0)
    item.hide_render = True
    item["origem"] = caminho.name
    item["nota"] = "Referência incorporada; blockout ainda exige modelagem e acabamento."


def preparar(args):
    if not bpy.app.background:
        raise RuntimeError("Execute com --background --factory-startup em um novo processo.")
    # A limpeza pertence somente ao processo background, nunca à janela do usuário.
    bpy.ops.wm.read_factory_settings(use_empty=True)
    # O importador converte segundos glTF para quadros usando o FPS atual.
    bpy.context.scene.render.fps = 60
    bpy.context.scene.render.fps_base = 1
    bpy.context.preferences.filepaths.save_version = 0
    if hasattr(bpy.context.preferences.filepaths, "file_preview_type"):
        bpy.context.preferences.filepaths.file_preview_type = "NONE"
    resultado = bpy.ops.import_scene.gltf(
        filepath=str(args.glb), import_pack_images=True, merge_vertices=False,
        import_shading="NORMALS", import_scene_as_collection=True, disable_bone_shape=True,
    )
    if "FINISHED" not in resultado:
        raise RuntimeError("A importação do GLB não foi concluída.")
    cena = bpy.context.scene
    cena.frame_set(0)
    meshes = [o for o in cena.objects if o.type == "MESH"]
    rigs = [o for o in cena.objects if o.type == "ARMATURE"]
    if not meshes or not rigs:
        raise RuntimeError("O GLB precisa conter malha e esqueleto importáveis.")
    # O repouso facilita comparar proporções; todas as ações continuam disponíveis.
    for rig in rigs:
        rig.data.pose_position = "REST"
        rig.show_in_front = True
    bpy.context.view_layer.update()
    cantos = [o.matrix_world @ Vector(canto) for o in meshes for canto in o.bound_box]
    minimo = Vector(tuple(min(p[eixo] for p in cantos) for eixo in range(3)))
    maximo = Vector(tuple(max(p[eixo] for p in cantos) for eixo in range(3)))
    centro = (minimo + maximo) / 2
    altura = maximo.z - minimo.z
    if altura <= 0 or not all(math.isfinite(v) for p in cantos for v in p):
        raise RuntimeError("A malha importada não tem limites válidos.")
    studio = bpy.data.collections.new("QA_Estudio_blockout")
    cena.collection.children.link(studio)
    chao(studio, centro, altura, minimo.z)
    # Potência acompanha a escala para manter a iluminação entre lutadores.
    potencia = altura * altura * 160
    luz(studio, "QA_LuzPrincipal", centro + Vector((altura * 2, -altura * 2, altura * 2.2)),
        centro, potencia, altura * 1.5, (1, 0.88, 0.77))
    luz(studio, "QA_LuzPreenchimento", centro + Vector((altura, altura * 2, altura)),
        centro, potencia * 0.55, altura * 2, (0.6, 0.76, 1))
    luz(studio, "QA_LuzRecorte", centro + Vector((-altura * 2, altura, altura * 1.6)),
        centro, potencia * 0.9, altura, (0.62, 0.8, 1))
    cena.world = bpy.data.worlds.new("QA_Mundo")
    cena.world.use_nodes = True
    fundo = cena.world.node_tree.nodes.get("Background")
    fundo.inputs["Color"].default_value = (0.035, 0.045, 0.07, 1)
    fundo.inputs["Strength"].default_value = 0.4
    cena.render.engine = "BLENDER_EEVEE"
    cena.render.resolution_x = 1024
    cena.render.resolution_y = 1024
    cena.render.resolution_percentage = 100
    cena.render.image_settings.file_format = "PNG"
    cena.render.image_settings.color_mode = "RGBA"
    cena.render.image_settings.color_depth = "8"
    cena.render.film_transparent = False
    cena.render.fps = 60
    cena.view_settings.view_transform = "AgX"
    cena.view_settings.exposure = 0
    if args.referencia:
        referencia(studio, args.referencia, centro, altura)
    cameras = {
        "3-4": camera(studio, "QA_Camera_3-4", (1, -1, 0.16), centro, altura, cantos, 1),
        "frente": camera(studio, "QA_Camera_Frente", (1, 0, 0), centro, altura, cantos, 1),
        "perfil": camera(studio, "QA_Camera_Perfil", (0, -1, 0), centro, altura, cantos, 1),
    }
    cena["etapa"] = "blockout articulado; não é o modelo final aprovado"
    cena["glb_origem"] = args.glb.name
    cena["orientacao"] = "Frente +X; vertical +Z após importação glTF."
    for acao in bpy.data.actions:
        acao.use_fake_user = True
    cena.frame_end = max(60, math.ceil(max((a.frame_range[1] for a in bpy.data.actions), default=60)))
    # O .blend abre com o rig selecionado e o estúdio separado da coleção importada.
    bpy.ops.object.select_all(action="DESELECT")
    for rig in rigs:
        rig.select_set(True)
    bpy.context.view_layer.objects.active = rigs[0]
    cena.camera = cameras["3-4"]
    for tela in bpy.data.screens:
        for area in tela.areas:
            if area.type == "VIEW_3D":
                area.spaces.active.region_3d.view_perspective = "CAMERA"
    args.saida.mkdir(parents=True, exist_ok=True)
    nome = args.glb.stem
    blend = args.saida / f"{nome}.blend"
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(blend), compress=True)
    renders = []
    for vista, item in cameras.items():
        cena.camera = item
        png = args.saida / f"{nome}-{vista}.png"
        cena.render.filepath = str(png)
        bpy.ops.render.render(write_still=True)
        renders.append(str(png))
    cena.camera = cameras["3-4"]
    cena.render.filepath = str(args.saida / f"{nome}-3-4.png")
    # Evita criar .blend1 apenas por repor a câmera de abertura após os renders.
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(blend), compress=True)
    print("KO_BLENDER_QA " + json.dumps({
        "nome": nome, "blend": str(blend), "renders": renders,
        "malhas": len(meshes), "vertices": sum(len(o.data.vertices) for o in meshes),
        "ossos": sum(len(r.data.bones) for r in rigs),
        "acoes": sorted(a.name for a in bpy.data.actions),
        "referencia_incorporada": bool(args.referencia), "final": False,
    }, ensure_ascii=False))


if __name__ == "__main__":
    preparar(argumentos())
