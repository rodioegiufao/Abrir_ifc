import { Color } from 'three';
import { IfcViewerAPI } from 'web-ifc-viewer';

let viewer;
let currentModelID = -1;
let lastProps = null; // Variável global para pesquisa no console

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
        
        viewer.shadowDropper.renderShadow(currentModelID);
        console.log("✅ Modelo IFC carregado com ID:", currentModelID);
        return model;
    }

    // =======================================================
    // 🔹 FUNÇÃO showProperties (VERSÃO COMPLETA - TODOS OS PSETS)
    // =======================================================
    function showProperties(props, expressID) {
        const panel = document.getElementById('properties-panel');
        const title = document.getElementById('element-title');
        const details = document.getElementById('element-details');
        
        if (!panel || !details) {
            console.error("IDs de painel não encontrados. Verifique seu index.html.");
            return;
        }

        // 1. INFORMAÇÕES BÁSICAS DO ELEMENTO
        const elementTypeName = props.type[0]?.Name?.value || props.type[0]?.constructor.name || 'Elemento Desconhecido';
        const elementType = props.constructor.name;
        const elementName = props.Name?.value || elementTypeName;

        title.textContent = elementName;
        
        let htmlContent = '';

        // 2. CABEÇALHO COM INFORMAÇÕES PRINCIPAIS
        htmlContent += `
            <div style="background: #f8f9fa; padding: 10px; border-radius: 5px; margin-bottom: 15px;">
                <h4 style="margin: 0 0 8px 0; color: #007bff;">Informações Gerais</h4>
                <p style="margin: 4px 0;"><strong>Tipo IFC:</strong> ${elementType}</p>
                <p style="margin: 4px 0;"><strong>Nome:</strong> ${elementName}</p>
                <p style="margin: 4px 0;"><strong>ID IFC:</strong> ${expressID}</p>
                <p style="margin: 4px 0;"><strong>Global ID:</strong> ${props.GlobalId?.value || 'N/A'}</p>
                ${props.Description?.value ? `<p style="margin: 4px 0;"><strong>Descrição:</strong> ${props.Description.value}</p>` : ''}
                ${props.ObjectType?.value ? `<p style="margin: 4px 0;"><strong>Tipo de Objeto:</strong> ${props.ObjectType.value}</p>` : ''}
                ${props.Tag?.value ? `<p style="margin: 4px 0;"><strong>Tag:</strong> ${props.Tag.value}</p>` : ''}
            </div>
        `;

        // 3. PROCESSAR TODOS OS PSETS
        if (props.psets && props.psets.length > 0) {
            htmlContent += `<h4 style="color: #28a745; border-bottom: 2px solid #28a745; padding-bottom: 5px;">Conjuntos de Propriedades (${props.psets.length} Psets)</h4>`;
            
            props.psets.forEach((pset, index) => {
                const psetName = pset.Name?.value || `Pset ${index + 1}`;
                const psetDescription = pset.Description?.value || '';
                
                htmlContent += `
                    <div style="background: white; border: 1px solid #ddd; border-radius: 5px; padding: 12px; margin-bottom: 15px;">
                        <h5 style="margin: 0 0 8px 0; color: #495057; font-size: 1.1em;">
                            ${psetName}
                            ${psetDescription ? `<br><small style="color: #6c757d; font-weight: normal;">${psetDescription}</small>` : ''}
                        </h5>
                `;

                // PROCESSAR PROPRIEDADES DESTE PSET
                if (pset.HasProperties && pset.HasProperties.length > 0) {
                    let propertiesHTML = '<ul style="list-style: none; padding-left: 0; margin: 0;">';
                    let propertiesFound = false;
                    
                    pset.HasProperties.forEach(propHandle => {
                        const prop = props[propHandle.value];
                        
                        if (prop && prop.Name && prop.NominalValue) {
                            propertiesFound = true;
                            const propName = prop.Name.value;
                            let propValue = prop.NominalValue.value;
                            
                            // FORMATAR VALORES ESPECIAIS
                            if (typeof propValue === 'boolean') {
                                propValue = propValue ? '✅ Sim' : '❌ Não';
                            } else if (propValue === null || propValue === undefined) {
                                propValue = '<em style="color: #6c757d;">N/A</em>';
                            } else if (typeof propValue === 'string' && propValue.trim() === '') {
                                propValue = '<em style="color: #6c757d;">(vazio)</em>';
                            }
                            
                            // DESTACAR PROPRIEDADES IMPORTANTES
                            const isImportant = ['Nome', 'Tipo', 'Material', 'Diâmetro', 'Comprimento', 'Altura', 'Largura', 'Insumo', 'Código'].includes(propName);
                            const propStyle = isImportant ? 'font-weight: bold; color: #e83e8c;' : '';
                            
                            propertiesHTML += `
                                <li style="margin-bottom: 6px; padding: 3px 0; border-bottom: 1px dotted #f0f0f0;">
                                    <span style="${propStyle}">${propName}:</span> 
                                    <span style="float: right; text-align: right; max-width: 60%; word-break: break-word;">${propValue}</span>
                                </li>
                            `;
                        }
                    });
                    
                    propertiesHTML += '</ul>';
                    
                    if (propertiesFound) {
                        htmlContent += propertiesHTML;
                    } else {
                        htmlContent += '<p style="color: #6c757d; margin: 5px 0;">Nenhuma propriedade encontrada neste Pset</p>';
                    }
                } else {
                    htmlContent += '<p style="color: #6c757d; margin: 5px 0;">Este Pset não contém propriedades</p>';
                }
                
                htmlContent += `</div>`;
            });
        } else {
            htmlContent += `
                <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; text-align: center;">
                    <h5 style="margin: 0; color: #856404;">⚠️ Nenhum Pset Encontrado</h5>
                    <p style="margin: 5px 0 0 0; color: #856404;">Este elemento não possui conjuntos de propriedades (Psets) definidos.</p>
                </div>
            `;
        }

        // 4. INFORMAÇÕES ADICIONAIS (se disponíveis)
        const additionalInfo = [];
        
        if (props.mats && props.mats.length > 0) {
            additionalInfo.push(`<strong>Materiais:</strong> ${props.mats.length} definidos`);
        }
        
        if (additionalInfo.length > 0) {
            htmlContent += `
                <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #dee2e6;">
                    <h5 style="color: #6c757d; margin-bottom: 8px;">Informações Adicionais</h5>
                    <ul style="color: #6c757d; list-style: none; padding-left: 0;">
                        ${additionalInfo.map(info => `<li>${info}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        // 5. EXIBIR NO PAINEL
        details.innerHTML = htmlContent;
        panel.style.display = 'block';
        
        // 6. LOG NO CONSOLE PARA DEBUG
        console.log(`📋 Elemento selecionado: ${elementName} (${elementType})`);
        console.log(`📊 Total de Psets: ${props.psets ? props.psets.length : 0}`);
        if (props.psets) {
            props.psets.forEach((pset, index) => {
                const psetName = pset.Name?.value || `Pset ${index + 1}`;
                const propCount = pset.HasProperties ? pset.HasProperties.length : 0;
                console.log(`   - ${psetName}: ${propCount} propriedades`);
            });
        }
    }

    // --- Inicialização ---
    viewer = CreateViewer(container);
    loadIfc('models/01.ifc');

    // =======================================================
    // 🔹 EVENTO DE DUPLO CLIQUE
    // =======================================================
    
    window.onmousemove = () => viewer.IFC.selector.prePickIfcItem();

    window.ondblclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        if (!viewer || !viewer.IFC || !viewer.IFC.selector) return;
        
        const item = await viewer.IFC.selector.pickIfcItem(true);

        if (!item || item.modelID === undefined || item.id === undefined) {
            document.getElementById('properties-panel').style.display = 'none';
            viewer.IFC.selector.unHighlightIfcItems();
            lastProps = null;
            return;
        }
        
        viewer.IFC.selector.unHighlightIfcItems();
        viewer.IFC.selector.highlightIfcItem(item, false);
        
        const props = await viewer.IFC.getProperties(item.modelID, item.id, true);
        
        // Armazena para pesquisa no console
        lastProps = props; 
        console.log("🟩 Item selecionado (Objeto Completo):", lastProps);
        
        showProperties(props, item.id);
    };

    // Atalhos do teclado
    window.onkeydown = (event) => {
        if (event.code === 'Escape') {
            viewer.IFC.selector.unpickIfcItems();
            viewer.IFC.selector.unHighlightIfcItems();
            document.getElementById('properties-panel').style.display = 'none';
            lastProps = null;
        }
    };
    
    // Upload de arquivo 
    const input = document.getElementById("file-input");
    if (input) {
        input.addEventListener("change", async (changed) => {
            const file = changed.target.files[0];
            if (file) {
                const ifcURL = URL.createObjectURL(file);
                await loadIfc(ifcURL);
                document.getElementById('properties-panel').style.display = 'none';
                lastProps = null;
            }
        });
    }

});