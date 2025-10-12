import { Color } from 'three';
import { IfcViewerAPI } from 'web-ifc-viewer';

let viewer;
let currentModelID = -1;
let lastPickedItem = null;

document.addEventListener('DOMContentLoaded', () => {

    const container = document.getElementById('viewer-container');

    // --- Cria o viewer ---
    function CreateViewer(container) {
        const newViewer = new IfcViewerAPI({
            container,
            backgroundColor: new Color(0xeeeeee)
        });
        newViewer.axes.setAxes();
        newViewer.grid.setGrid();
        newViewer.clipper.active = true;
        return newViewer;
    }

    // --- Carrega um IFC ---
    async function loadIfc(url) {
        if (viewer) await viewer.dispose();
        viewer = CreateViewer(container);
        await viewer.IFC.setWasmPath("/wasm/");
        const model = await viewer.IFC.loadIfcUrl(url);
        currentModelID = model.modelID;

        // Aguarda o carregamento completo
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Método mais confiável para obter todos os IDs
        await createVisibleSubset();
        
        viewer.shadowDropper.renderShadow(currentModelID);
        return model;
    }

    // --- Cria subset visível com todos os elementos ---
    async function createVisibleSubset() {
        if (currentModelID === -1) return;
        
        try {
            // Método alternativo: obtém IDs de diferentes tipos comuns
            const commonTypes = [
                1,  // IfcProject
                2,  // IfcSite  
                3,  // IfcBuilding
                4,  // IfcBuildingStorey
                5,  // IfcSpace
                106, // IfcWall
                108, // IfcSlab
                109, // IfcBeam
                110, // IfcColumn
                111, // IfcDoor
                112, // IfcWindow
                113, // IfcPlate
            ];
            
            let allIds = [];
            
            for (const type of commonTypes) {
                try {
                    const ids = await viewer.IFC.loader.ifcManager.getAllItemsOfType(
                        currentModelID,
                        type,
                        false
                    );
                    allIds = [...allIds, ...ids];
                } catch (e) {
                    // Tipo pode não existir no modelo, continua
                    console.log(`Tipo ${type} não encontrado`);
                }
            }
            
            // Alternativa: se ainda estiver vazio, tenta método direto
            if (allIds.length === 0) {
                console.warn("Método por tipos falhou, tentando abordagem alternativa...");
                
                // Usa a geometria carregada para obter IDs
                const mesh = viewer.IFC.loader.ifcManager.getMesh(currentModelID);
                if (mesh && mesh.geometry) {
                    // Obtém IDs dos atributos de geometria
                    const attributes = mesh.geometry.attributes;
                    if (attributes && attributes.expressID) {
                        const expressIDs = attributes.expressID.array;
                        allIds = [...new Set(expressIDs)]; // Remove duplicatas
                    }
                }
            }
            
            console.log(`🔹 Criando subset com ${allIds.length} elementos`);
            
            viewer.IFC.loader.ifcManager.createSubset({
                modelID: currentModelID,
                ids: allIds,
                removePrevious: true,
                customID: "visibleSubset"
            });
            
        } catch (error) {
            console.error("Erro ao criar subset:", error);
        }
    }

    // --- Inicializa ---
    viewer = CreateViewer(container);
    loadIfc('models/01.ifc');

    const input = document.getElementById("file-input");
    const hideSelectedButton = document.getElementById("hide-selected");
    const showAllButton = document.getElementById("show-all");

    // --- Upload manual ---
    if (input) {
        input.addEventListener("change", async (changed) => {
            const file = changed.target.files[0];
            const ifcURL = URL.createObjectURL(file);
            await loadIfc(ifcURL);
        }, false);
    }

    // =======================================================
    // 🔹 CONTROLE DE VISIBILIDADE USANDO SUBSETS (CORRIGIDO)
    // =======================================================

    async function hideSelected() {
        if (!lastPickedItem || currentModelID === -1) {
            alert("Nenhum item selecionado. Dê um duplo clique para selecionar primeiro.");
            return;
        }

        const expressID = lastPickedItem.id;
        console.log(`🔹 Tentando ocultar item ${expressID}`);

        try {
            // Verifica se o subset existe antes de remover
            const subset = viewer.IFC.loader.ifcManager.subsets["visibleSubset"];
            if (!subset) {
                console.warn("Subset 'visibleSubset' não encontrado, criando...");
                await createVisibleSubset();
            }

            // Remove o item do subset visível
            viewer.IFC.loader.ifcManager.removeFromSubset(
                currentModelID,
                [expressID],
                "visibleSubset"
            );

            console.log(`✅ Item ${expressID} ocultado com sucesso.`);
            
            // Força atualização da cena
            viewer.context.renderer.render();
            
        } catch (error) {
            console.error("Erro ao ocultar item:", error);
            
            // Fallback: tenta método alternativo
            await hideSelectedFallback(expressID);
        }
        
        viewer.IFC.selector.unpickIfcItems();
        lastPickedItem = null;
    }

    // --- Método alternativo caso o principal falhe ---
    async function hideSelectedFallback(expressID) {
        console.log("🔹 Tentando método alternativo para ocultar...");
        
        try {
            // Método direto: manipula a visibilidade do mesh
            const mesh = viewer.IFC.loader.ifcManager.getMesh(currentModelID);
            if (mesh) {
                // Encontra a geometria correspondente ao expressID
                mesh.visible = false;
                
                // Cria um subset sem o elemento oculto
                const allIds = await getAllExpressIDs();
                const filteredIds = allIds.filter(id => id !== expressID);
                
                viewer.IFC.loader.ifcManager.createSubset({
                    modelID: currentModelID,
                    ids: filteredIds,
                    removePrevious: true,
                    customID: "visibleSubset"
                });
                
                console.log(`✅ Item ${expressID} ocultado (método alternativo).`);
            }
        } catch (error) {
            console.error("Método alternativo também falhou:", error);
        }
    }

    // --- Obtém todos os ExpressIDs do modelo ---
    async function getAllExpressIDs() {
        try {
            // Tenta obter via API do ifcManager
            const spatialStructure = await viewer.IFC.loader.ifcManager.getSpatialStructure(currentModelID);
            const allIds = [];
            
            function collectIDs(item) {
                if (item.expressID) allIds.push(item.expressID);
                if (item.children) {
                    item.children.forEach(child => collectIDs(child));
                }
            }
            
            collectIDs(spatialStructure);
            return allIds;
            
        } catch (error) {
            console.error("Erro ao obter ExpressIDs:", error);
            return [];
        }
    }

    async function showAll() {
        if (currentModelID === -1) return;

        console.log("🔹 Restaurando visibilidade de todos os elementos...");
        
        await createVisibleSubset();
        console.log(`✅ Todos os elementos foram exibidos novamente.`);
        
        // Força atualização da cena
        viewer.context.renderer.render();
    }

    if (hideSelectedButton) hideSelectedButton.onclick = hideSelected;
    if (showAllButton) showAllButton.onclick = showAll;

    // =======================================================
    // 🔹 INTERAÇÕES DE SELEÇÃO
    // =======================================================
    window.onmousemove = () => viewer.IFC.selector.prePickIfcItem();

    window.ondblclick = async () => {
        const item = await viewer.IFC.selector.pickIfcItem(true);
        if (!item || item.modelID === undefined || item.id === undefined) return;
        lastPickedItem = item;
        
        const props = await viewer.IFC.getProperties(item.modelID, item.id, true);
        console.log("🟩 Item selecionado:", props);
        
        // Destaca visualmente o item selecionado
        viewer.IFC.selector.highlightIfcItem(item, false);
    };

    // Atalhos do teclado
    window.onkeydown = (event) => {
        if (event.code === 'KeyP') viewer.clipper.createPlane();
        else if (event.code === 'KeyO') viewer.clipper.deletePlane();
        else if (event.code === 'Escape') {
            viewer.IFC.selector.unpickIfcItems();
            viewer.IFC.selector.unHighlightIfcItems();
            lastPickedItem = null;
        } else if (event.code === 'KeyH') {
            // Atalho para ocultar (H)
            hideSelected();
        } else if (event.code === 'KeyS') {
            // Atalho para mostrar tudo (S)
            showAll();
        }
    };
});