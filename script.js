// ========================================================================
// Rota Fácil - script.js
// VERSÃO BASE + ADIÇÃO/REMOÇÃO MANUAL FUNCIONAL (via Autocomplete)
// ========================================================================

// --- Variáveis Globais ---
let map;
let placesService;
let foundMarkers = [];            // Guarda marcadores da BUSCA POR CATEGORIA E ADIÇÃO MANUAL
let currentUserLocation = null;   // Guarda coords {lat, lng} do usuário
let userLocationMarker = null;    // Guarda o objeto Marker da SETA do usuário
let userLocationAccuracyCircle = null; // Guarda o objeto Circle da precisão
let watchId = null;               // Guarda o ID do watchPosition

// --- Serviços de Rota (Inicializados depois, se necessário) ---
let directionsService = null;
let directionsRenderer = null;
let currentRouteResult = null;
let currentRouteRequest = null;
let isRecalculating = false;

// --- Elementos da UI (Inicializados em setupEventListeners) ---
let appContainer = null;
let routeFoundBtn = null;
let backButton = null; // Mantido, mas desativado
let searchInput = null; // Input para busca manual
let addLocationBtn = null; // Botão (não terá ação direta)
let selectedLocationsList = null; // Lista UL
let autocomplete = null; // Serviço Autocomplete

// --- Reset Inicial (Exatamente como no script base) ---
userLocationMarker = null; userLocationAccuracyCircle = null;
if (navigator.geolocation && typeof watchId !== 'undefined' && watchId !== null) { try { navigator.geolocation.clearWatch(watchId); } catch (e) {} }
watchId = null; foundMarkers = []; console.log(">>> Script Init: Resetado.");
// -------------------------------------------------------

// updateUserMarkerAndAccuracy (Exatamente como no script base)
function updateUserMarkerAndAccuracy(position) { /* ...código original sem alterações... */ }

// handleLocationError (Exatamente como no script base)
function handleLocationError(error, isWatching) { /* ...código original sem alterações... */ }

// initMap (Exatamente como no script base)
function initMap() { /* ...código original sem alterações... */ }

// startWatchingPosition (Exatamente como no script base)
function startWatchingPosition() { /* ...código original sem alterações... */ }

// initializeMapAndServices (Exatamente como no script base)
function initializeMapAndServices(initialCoords, initialZoom) { /* ...código original sem alterações... */ }


/**
 * Configura TODOS os listeners de eventos necessários.
 * >>> FOCO: Adicionar Autocomplete e lógica de lista manual. <<<
 */
function setupEventListeners() {
    console.log(">>> setupEventListeners: Configurando...");

    // Pega referências
    appContainer = document.getElementById('app-container');
    backButton = document.getElementById('back-button');
    searchInput = document.getElementById('search-input'); // Campo de busca manual
    addLocationBtn = document.getElementById('add-location-btn'); // Botão adicionar
    selectedLocationsList = document.getElementById('selected-locations-list'); // Lista UL
    const categoryButtons = document.querySelectorAll('.category-btn');
    routeFoundBtn = document.getElementById('route-found-btn');

    // Verifica elementos essenciais
    let missingElement = null;
    if (!appContainer) missingElement = '#app-container';
    else if (!searchInput) missingElement = '#search-input'; // ESSENCIAL
    else if (!addLocationBtn) missingElement = '#add-location-btn'; // Pega ref, mas ação é via Autocomplete
    else if (!selectedLocationsList) missingElement = '#selected-locations-list'; // ESSENCIAL
    else if (!categoryButtons || categoryButtons.length === 0) missingElement = '.category-btn';
    else if (!routeFoundBtn) missingElement = '#route-found-btn';
    if (missingElement) { console.error(`ERRO FATAL: Elemento "${missingElement}" não encontrado!`); return; }
    // Aviso se backButton não existe, mas não impede execução
    if (!backButton) { console.warn("AVISO: Botão #back-button não encontrado."); }


    // --- Listener Botões de Categoria (Exatamente como no script base) ---
    // LEMBRETE: Chama clearFoundMarkers(), que limpa TUDO (manuais incluídos).
    categoryButtons.forEach(button => {
        button.addEventListener('click', function() {
            const categoryType = this.dataset.category;
            console.log(`>>> CATEGORIA CLICADA: "${categoryType}" <<<`);
            if (!map || !placesService) { alert("Mapa/Places não pronto!"); return; }
            console.log(`--- Iniciando busca por categoria "${categoryType}" ---`);
            if(routeFoundBtn) routeFoundBtn.disabled = true;

            // Limpa marcadores anteriores (CATEGORIA E MANUAIS) e a lista visual
            clearFoundMarkers();

            let request;
            if (currentUserLocation) {
                request = { location: currentUserLocation, radius: 5000, keyword: categoryType };
                placesService.nearbySearch(request, handleSearchResults);
            } else {
                const bounds = map.getBounds();
                if (!bounds) { alert("Área do mapa indefinida."); return; }
                request = { bounds: bounds, query: categoryType };
                placesService.textSearch(request, handleSearchResults);
            }
        });
    });

    // --- Listener Botão "Traçar Rota" (Exatamente como no script base) ---
    // Usará a lista foundMarkers que agora contém locais de categoria E manuais.
    if (routeFoundBtn) {
        routeFoundBtn.addEventListener('click', function() {
            console.log(`>>> [Traçar Rota Clicado] Iniciando. Total de locais: ${foundMarkers.length}`);
             if (!directionsService || !directionsRenderer) { alert("ERRO: Serviço de rotas não pronto."); return; }
             if (!foundMarkers || foundMarkers.length === 0) { alert("Nenhum local encontrado ou adicionado para a rota."); return; }
             if (!map) { alert("ERRO: Mapa não está pronto."); return; }

             this.disabled = true; this.textContent = "Localizando...";

             if (navigator.geolocation) {
                 navigator.geolocation.getCurrentPosition(
                     (position) => {
                         this.textContent = "Calculando Rota...";
                         const userPos = { lat: position.coords.latitude, lng: position.coords.longitude };
                         currentUserLocation = userPos;
                         updateUserMarkerAndAccuracy(position);

                         if (directionsRenderer) directionsRenderer.setDirections({ routes: [] });

                         const MAX_ALLOWED_WAYPOINTS = 10;
                         const markersForRoute = foundMarkers.slice(0, MAX_ALLOWED_WAYPOINTS + 1);
                         const waypointsLimited = markersForRoute.map(m => ({ location: m.getPosition(), stopover: true }));

                         let originPoint = userPos;
                         let destinationPoint;
                         let waypointsForRequest = [];

                         if (waypointsLimited.length === 0) { alert("Erro interno: Nenhum marcador válido."); this.disabled = false; this.textContent = "Traçar Rota"; return; }
                         else if (waypointsLimited.length === 1) { destinationPoint = waypointsLimited[0].location; }
                         else { destinationPoint = waypointsLimited[waypointsLimited.length - 1].location; waypointsForRequest = waypointsLimited.slice(0, -1); }

                         const request = { origin: originPoint, destination: destinationPoint, waypoints: waypointsForRequest, optimizeWaypoints: true, travelMode: google.maps.TravelMode.DRIVING };

                         directionsService.route(request, (result, status) => {
                             if (status === google.maps.DirectionsStatus.OK) {
                                 directionsRenderer.setDirections(result);
                                 currentRouteResult = result; currentRouteRequest = request; isRecalculating = false;
                                 if (appContainer) {
                                     appContainer.classList.add('map-only-mode'); // Ativa modo mapa
                                     setTimeout(() => { if (map) { google.maps.event.trigger(map, 'resize'); if (result.routes[0].bounds) { map.fitBounds(result.routes[0].bounds); } } }, 350);
                                 }
                                 this.textContent = "Rota Traçada";
                             } else {
                                 alert(`Não foi possível calcular a rota: ${status}.`);
                                 currentRouteResult = null; currentRouteRequest = null;
                                 this.disabled = foundMarkers.length === 0; this.textContent = "Traçar Rota";
                             }
                         });
                     }, (error) => {
                         alert("Não foi possível obter sua localização para traçar a rota.");
                         this.disabled = foundMarkers.length === 0; this.textContent = "Traçar Rota";
                     }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
                 );
             } else {
                 alert("Geolocalização não suportada."); this.disabled = foundMarkers.length === 0; this.textContent = "Traçar Rota";
             }
        });
    }


    // --- Listener Botão Adicionar Manual (Ação desativada) ---
     if (addLocationBtn) {
         addLocationBtn.addEventListener('click', () => {
             console.log("Botão Adicionar Manual clicado - Ação via seleção do Autocomplete.");
         });
         // Opcional: Desabilitar o botão, já que ele não faz nada
         // addLocationBtn.disabled = true;
     }

    // *******************************************************************
    // ***** INÍCIO: CÓDIGO PARA ADIÇÃO MANUAL E REMOÇÃO DA LISTA *****
    // *******************************************************************

    // --- Configuração do Autocomplete ---
    if (searchInput && map && google && google.maps && google.maps.places) { // Verifica se API está pronta
        console.log(">>> Configurando Autocomplete...");
        try {
            autocomplete = new google.maps.places.Autocomplete(searchInput, {
                // types: ['establishment'], // Pode descomentar para restringir
                componentRestrictions: { country: "br" }, // Restringe ao Brasil
                fields: ["place_id", "geometry", "name", "formatted_address"] // Dados necessários
            });

            autocomplete.bindTo('bounds', map); // Sugestões baseadas na área do mapa

            autocomplete.addListener('place_changed', () => {
                console.log("--- Autocomplete: Local selecionado ---");
                const place = autocomplete.getPlace();

                if (!place.geometry || !place.geometry.location) {
                    console.warn("Autocomplete: Local inválido ou sem coordenadas.");
                    return;
                }

                // Verifica se local já foi adicionado (pelo place_id)
                const alreadyExists = foundMarkers.some(marker => marker.placeId === place.place_id);
                if (alreadyExists) {
                    console.log(`Autocomplete: Local "${place.name}" já está na lista.`);
                    alert(`"${place.name}" já foi adicionado.`);
                    searchInput.value = ''; // Limpa input mesmo se já existe
                    return;
                }

                console.log(`Autocomplete: Adicionando "${place.name}"`);

                // 1. Criar Marcador
                const manualMarker = new google.maps.Marker({
                    map: map,
                    position: place.geometry.location,
                    title: place.name,
                    // icon: 'url_para_icone_manual.png' // Opcional: Ícone diferente
                });
                manualMarker.placeId = place.place_id; // Guarda ID único

                // 2. Adicionar ao Array Geral
                foundMarkers.push(manualMarker);
                console.log(`   Marcador adicionado a foundMarkers. Total: ${foundMarkers.length}`);

                // 3. Adicionar à Lista Visual (UL)
                addPlaceToList(place.name, place.formatted_address, manualMarker.placeId);

                // 4. Ajustar Mapa e Limpar Input
                map.panTo(place.geometry.location); // Centraliza suavemente
                // map.setZoom(15); // Opcional: definir zoom
                searchInput.value = '';

                // 5. Habilitar Botão Traçar Rota
                if (routeFoundBtn) {
                    routeFoundBtn.disabled = false;
                    console.log("   Botão Traçar Rota HABILITADO.");
                }
            });
        } catch (e) {
            console.error("!!! ERRO ao inicializar Autocomplete:", e);
            alert("Erro ao ativar a busca por locais. Tente recarregar a página.");
        }
    } else {
        console.error("Autocomplete não iniciado: Input, Mapa ou API do Google Places não prontos.");
    }

    // --- Listener para Remover Itens da Lista Manual ---
    if (selectedLocationsList) {
        selectedLocationsList.addEventListener('click', function(event) {
            if (event.target && event.target.classList.contains('remove-btn')) {
                const listItem = event.target.closest('li');
                const placeIdToRemove = listItem.dataset.placeId;

                if (!placeIdToRemove) { console.error("Remover: place_id não encontrado no LI."); return; }
                console.log(`--- Remover: Tentando remover place_id: ${placeIdToRemove}`);

                let markerIndex = foundMarkers.findIndex(marker => marker.placeId === placeIdToRemove);

                if (markerIndex > -1) {
                    // Remove do mapa
                    foundMarkers[markerIndex].setMap(null);
                    console.log(`   Marcador "${foundMarkers[markerIndex].getTitle()}" removido do mapa.`);
                    // Remove do array
                    foundMarkers.splice(markerIndex, 1);
                    console.log(`   Marcador removido de foundMarkers. Restantes: ${foundMarkers.length}`);
                    // Remove da lista visual
                    listItem.remove();
                    console.log("   Item removido da lista UL.");
                    // Atualiza botão traçar rota
                    if (routeFoundBtn) {
                        routeFoundBtn.disabled = foundMarkers.length === 0;
                        console.log(`   Botão Traçar Rota ${routeFoundBtn.disabled ? 'DESABILITADO' : 'HABILITADO'}.`);
                    }
                } else {
                    console.error(`Remover: Marcador com place_id ${placeIdToRemove} não encontrado em foundMarkers.`);
                    listItem.remove(); // Remove da lista visual mesmo assim
                }
            }
        });
    }
    // *******************************************************************
    // ***** FIM: CÓDIGO PARA ADIÇÃO MANUAL E REMOÇÃO DA LISTA *****
    // *******************************************************************


    // --- Listener Botão Voltar (Lógica interna desativada por enquanto) ---
    if (backButton && appContainer) {
        backButton.addEventListener('click', () => {
             console.log("Botão Voltar clicado (lógica desativada).");
             alert("Funcionalidade do Botão Voltar desativada.");
             // Para reativar, descomente o bloco de código do botão voltar aqui.
        });
    }

    console.log(">>> setupEventListeners: Concluído.");
} // --- FIM DA FUNÇÃO setupEventListeners ---

/**
 * NOVA FUNÇÃO: Adiciona um item à lista visual UL.
 */
function addPlaceToList(name, address, placeId) {
    if (!selectedLocationsList || !placeId) { return; }

    const listItem = document.createElement('li');
    listItem.dataset.placeId = placeId; // Armazena ID para remoção

    let displayText = name;
    if (address) { // Adiciona endereço se disponível, de forma mais curta
        let shortAddress = address.split(',')[0]; // Pega só a primeira parte do endereço
        if (shortAddress.toLowerCase() !== name.toLowerCase()) {
             displayText += ` (${shortAddress})`;
        }
    }
    listItem.textContent = displayText; // Define o texto

    const removeButton = document.createElement('button');
    removeButton.textContent = 'X'; // Botão Remover mais curto
    removeButton.classList.add('remove-btn');
    // Estilos básicos (pode mover para CSS)
    removeButton.style.marginLeft = '8px';
    removeButton.style.padding = '2px 5px';
    removeButton.style.fontSize = '0.8em';
    removeButton.style.cursor = 'pointer';
    removeButton.style.color = 'red';
    removeButton.style.border = '1px solid red';
    removeButton.style.background = 'none';

    listItem.appendChild(removeButton); // Adiciona botão ao LI
    selectedLocationsList.appendChild(listItem); // Adiciona LI à UL
    console.log(`   Item adicionado à lista UL: ${name}`);
}


// handleSearchResults (Exatamente como no script base)
// Processa resultados da BUSCA POR CATEGORIA
function handleSearchResults(results, status) {
    console.log(`>>> handleSearchResults (Categoria): Status: "${status}". Resultados:`, results ? results.length : 0);
    // clearFoundMarkers() é chamado ANTES no listener da categoria

    if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
        let bounds = new google.maps.LatLngBounds();
        let validCount = 0;
        results.forEach((place, index) => {
            if (place.name && place.geometry && place.geometry.location) {
                try {
                     const categoryMarker = new google.maps.Marker({ position: place.geometry.location, map: map, title: place.name });
                     // NÃO adiciona placeId a marcadores de categoria
                     foundMarkers.push(categoryMarker); // Adiciona ao array geral
                     bounds.extend(place.geometry.location);
                     validCount++;
                } catch(e) { console.error(`Erro marcador categoria ${place.name}:`, e); }
            }
        });

        if (validCount > 0) {
             console.log(`>>> handleSearchResults (Categoria): ${validCount} marcadores adicionados.`);
             if (currentUserLocation) bounds.extend(currentUserLocation);
             // Inclui marcadores MANUAIS existentes no ajuste do mapa
             foundMarkers.forEach(marker => { if (marker.getMap() === map) { bounds.extend(marker.getPosition()); } });

             if (!bounds.isEmpty()) {
                 try { map.fitBounds(bounds); if (map.getZoom() > 16) map.setZoom(16); }
                 catch (e) { console.error("Erro fitBounds/setZoom (Categoria):", e); }
             }
             if (routeFoundBtn) routeFoundBtn.disabled = false;
        } else {
             if (routeFoundBtn) routeFoundBtn.disabled = foundMarkers.length === 0; // Baseado no total (inclui manuais)
        }
    } else {
         if (routeFoundBtn) routeFoundBtn.disabled = foundMarkers.length === 0; // Baseado no total (inclui manuais)
         console.warn(`>>> handleSearchResults (Categoria): Sem resultados ou erro. Status: ${status}.`);
    }
    console.log(">>> handleSearchResults (Categoria): FIM.");
}


// clearFoundMarkers (Exatamente como no script base - Limpa TUDO)
// Chamado APENAS ao clicar em um botão de CATEGORIA.
function clearFoundMarkers() {
    console.log(`>>> clearFoundMarkers: Limpando ${foundMarkers.length} marcadores.`);
    if (foundMarkers && foundMarkers.length > 0) {
         try { foundMarkers.forEach((marker) => { if (marker && marker.setMap) { marker.setMap(null); } }); }
         catch (e) { console.error(`Erro ao remover marcadores:`, e); }
    }
    foundMarkers = []; // Limpa o array
    if(selectedLocationsList) { // Limpa a lista visual UL
        selectedLocationsList.innerHTML = '';
        console.log("   Lista visual UL limpa.");
    }
    if (routeFoundBtn) { routeFoundBtn.disabled = true; } // Desabilita botão
    console.log(`>>> clearFoundMarkers: Limpeza concluída.`);
}

// Chamada inicial (Exatamente como no script base)
console.log("Aguardando API do Google Maps chamar initMap...");