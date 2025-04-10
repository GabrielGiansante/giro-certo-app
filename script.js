// ========================================================================
// Rota Fácil - script.js
// VERSÃO BASE + ADD MANUAL + BOTÃO VOLTAR FUNCIONAL
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
let currentRouteResult = null; // Guarda o resultado da rota
let currentRouteRequest = null;// Guarda a requisição da rota
let isRecalculating = false;

// --- Elementos da UI (Inicializados em setupEventListeners) ---
let appContainer = null;
let routeFoundBtn = null;
let backButton = null; // <<< BOTÃO VOLTAR
let searchInput = null;
let addLocationBtn = null;
let selectedLocationsList = null;
let autocomplete = null;

// --- Reset Inicial (Exatamente como no script base funcional) ---
userLocationMarker = null; userLocationAccuracyCircle = null;
if (navigator.geolocation && typeof watchId !== 'undefined' && watchId !== null) { try { navigator.geolocation.clearWatch(watchId); } catch (e) { console.error(">>> Script Init: Erro ao limpar watchId:", e); } }
watchId = null; foundMarkers = []; console.log(">>> Script Init: Resetado.");
// -------------------------------------------------------

// updateUserMarkerAndAccuracy (Exatamente como no script base funcional)
function updateUserMarkerAndAccuracy(position) { /* ...código original sem alterações... */ }

// handleLocationError (Exatamente como no script base funcional)
function handleLocationError(error, isWatching) { /* ...código original sem alterações... */ }

// initMap (Exatamente como no script base funcional)
function initMap() { /* ...código original sem alterações... */ }

// startWatchingPosition (Exatamente como no script base funcional)
function startWatchingPosition() { /* ...código original sem alterações... */ }

// initializeMapAndServices (Exatamente como no script base funcional)
function initializeMapAndServices(initialCoords, initialZoom) { /* ...código original sem alterações... */ }


/**
 * Configura TODOS os listeners de eventos necessários.
 * >>> FOCO: Reativar lógica do Botão Voltar <<<
 */
function setupEventListeners() {
    console.log(">>> setupEventListeners: Configurando...");

    // Pega referências
    appContainer = document.getElementById('app-container');
    backButton = document.getElementById('back-button'); // <<< ESSENCIAL
    searchInput = document.getElementById('search-input');
    addLocationBtn = document.getElementById('add-location-btn');
    selectedLocationsList = document.getElementById('selected-locations-list');
    const categoryButtons = document.querySelectorAll('.category-btn');
    routeFoundBtn = document.getElementById('route-found-btn');

    // Verifica elementos essenciais (AGORA backButton é essencial)
    let missingElement = null;
    if (!appContainer) missingElement = '#app-container';
    else if (!searchInput) missingElement = '#search-input';
    else if (!addLocationBtn) missingElement = '#add-location-btn';
    else if (!selectedLocationsList) missingElement = '#selected-locations-list';
    else if (!categoryButtons || categoryButtons.length === 0) missingElement = '.category-btn';
    else if (!routeFoundBtn) missingElement = '#route-found-btn';
    else if (!backButton) missingElement = '#back-button'; // <<< VERIFICAÇÃO ESSENCIAL
    if (missingElement) { console.error(`ERRO FATAL: Elemento "${missingElement}" não encontrado!`); return; }


    // --- Listener Botões de Categoria (Exatamente como no script base funcional) ---
    categoryButtons.forEach(button => {
        button.addEventListener('click', function() {
            const categoryType = this.dataset.category;
            console.log(`>>> CATEGORIA CLICADA: "${categoryType}" <<<`);
            if (!map || !placesService) { alert("Mapa/Places não pronto!"); return; }
            console.log(`--- Iniciando busca por categoria "${categoryType}" ---`);
            if(routeFoundBtn) routeFoundBtn.disabled = true;
            clearFoundMarkers(); // Limpa TUDO (manuais incluídos) e lista UL
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

    // --- Listener Botão "Traçar Rota" (Exatamente como no script base funcional) ---
    // Este listener já adiciona 'map-only-mode' e guarda currentRouteResult/Request
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
                         currentUserLocation = userPos; updateUserMarkerAndAccuracy(position);
                         if (directionsRenderer) directionsRenderer.setDirections({ routes: [] });
                         const MAX_ALLOWED_WAYPOINTS = 10; const markersForRoute = foundMarkers.slice(0, MAX_ALLOWED_WAYPOINTS + 1);
                         const waypointsLimited = markersForRoute.map(m => ({ location: m.getPosition(), stopover: true }));
                         let originPoint = userPos; let destinationPoint; let waypointsForRequest = [];
                         if (waypointsLimited.length === 0) { alert("Erro interno: Nenhum marcador válido."); this.disabled = false; this.textContent = "Traçar Rota"; return; }
                         else if (waypointsLimited.length === 1) { destinationPoint = waypointsLimited[0].location; }
                         else { destinationPoint = waypointsLimited[waypointsLimited.length - 1].location; waypointsForRequest = waypointsLimited.slice(0, -1); }
                         const request = { origin: originPoint, destination: destinationPoint, waypoints: waypointsForRequest, optimizeWaypoints: true, travelMode: google.maps.TravelMode.DRIVING };
                         directionsService.route(request, (result, status) => {
                             if (status === google.maps.DirectionsStatus.OK) {
                                 directionsRenderer.setDirections(result);
                                 currentRouteResult = result; currentRouteRequest = request; isRecalculating = false; // Guarda estado
                                 if (appContainer) {
                                     appContainer.classList.add('map-only-mode'); // <<< ATIVA MODO MAPA
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
                         this.disabled = foundMarkers.length === 0; this.textContent = "Traçar Rota"; handleLocationError(error, false);
                     }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
                 );
             } else {
                 alert("Geolocalização não suportada."); this.disabled = foundMarkers.length === 0; this.textContent = "Traçar Rota";
             }
        });
    }


    // --- Listener Botão Adicionar Manual (Ação desativada) ---
     if (addLocationBtn) { addLocationBtn.addEventListener('click', () => { console.log("Ação via seleção do Autocomplete."); }); }

    // --- Código Autocomplete e Remoção Manual (Exatamente como no script base funcional) ---
    setTimeout(() => {
        if (searchInput && map && typeof google !== 'undefined' && google.maps && google.maps.places) {
            try {
                autocomplete = new google.maps.places.Autocomplete(searchInput, { componentRestrictions: { country: "br" }, fields: ["place_id", "geometry", "name", "formatted_address"] });
                autocomplete.bindTo('bounds', map);
                autocomplete.addListener('place_changed', () => {
                    const place = autocomplete.getPlace();
                    if (!place.geometry || !place.geometry.location) return;
                    const alreadyExists = foundMarkers.some(marker => marker.placeId === place.place_id);
                    if (alreadyExists) { alert(`"${place.name}" já adicionado.`); searchInput.value = ''; return; }
                    const manualMarker = new google.maps.Marker({ map: map, position: place.geometry.location, title: place.name });
                    manualMarker.placeId = place.place_id;
                    foundMarkers.push(manualMarker); addPlaceToList(place.name, place.formatted_address, manualMarker.placeId);
                    map.panTo(place.geometry.location); searchInput.value = '';
                    if (routeFoundBtn) routeFoundBtn.disabled = false;
                });
            } catch (e) { console.error("ERRO Autocomplete:", e); }
        } else { console.error("Autocomplete não iniciado."); }
    }, 1500);

    if (selectedLocationsList) {
        selectedLocationsList.addEventListener('click', function(event) {
            if (event.target && event.target.classList.contains('remove-btn')) {
                const listItem = event.target.closest('li'); const placeIdToRemove = listItem.dataset.placeId;
                if (!placeIdToRemove) return;
                let markerIndex = foundMarkers.findIndex(marker => marker.placeId === placeIdToRemove);
                if (markerIndex > -1) {
                    foundMarkers[markerIndex].setMap(null); foundMarkers.splice(markerIndex, 1); listItem.remove();
                    if (routeFoundBtn) routeFoundBtn.disabled = foundMarkers.length === 0;
                } else { listItem.remove(); }
            }
        });
    }

    // *******************************************************************
    // ***** INÍCIO: LÓGICA DO BOTÃO VOLTAR REATIVADA E CORRIGIDA *****
    // *******************************************************************
    if (backButton && appContainer && routeFoundBtn) { // Verifica se todos os elementos necessários existem
        backButton.addEventListener('click', () => {
            console.log(">>> Botão Voltar (Mapa) clicado.");

            // 1. Limpar a rota visualmente
            if (directionsRenderer) {
                try {
                    directionsRenderer.setDirections({ routes: [] }); // Limpa a rota desenhada
                    console.log("   Rota visual limpa.");
                } catch (e) { console.error("   Erro ao limpar directionsRenderer:", e); }
            } else { console.warn("   directionsRenderer não disponível para limpar rota."); }

            // 2. Remover o modo "mapa apenas" do container principal
            if (appContainer) {
                appContainer.classList.remove('map-only-mode'); // <<< REMOVE A CLASSE CSS
                console.log("   Classe 'map-only-mode' removida.");
                // O CSS configurado anteriormente deve esconder o #back-button e mostrar #controls
            }

            // 3. Resetar o botão "Traçar Rota"
            if (routeFoundBtn) {
                routeFoundBtn.textContent = "Traçar Rota";
                // Reabilitar botão SOMENTE se ainda existirem marcadores (manuais ou de categoria)
                routeFoundBtn.disabled = foundMarkers.length === 0;
                console.log(`   Botão 'Traçar Rota' resetado. Habilitado: ${!routeFoundBtn.disabled}`);
            }

            // 4. Limpar variáveis de estado da rota atual
            currentRouteResult = null;
            currentRouteRequest = null;
            isRecalculating = false;
            console.log("   Variáveis de estado da rota limpas.");

            // 5. Disparar redimensionamento do mapa (APÓS mudança de layout)
            setTimeout(() => {
                try {
                    if (map) { // Verifica se mapa existe
                       google.maps.event.trigger(map, 'resize');
                       console.log("   Evento 'resize' do mapa disparado.");
                       // Opcional: Reajustar o zoom para mostrar os marcadores existentes?
                       if (foundMarkers.length > 0) {
                           let bounds = new google.maps.LatLngBounds();
                           if (currentUserLocation) bounds.extend(currentUserLocation);
                           foundMarkers.forEach(marker => { if (marker.getMap() === map) bounds.extend(marker.getPosition()); });
                           if (!bounds.isEmpty()) {
                               map.fitBounds(bounds);
                               if (map.getZoom() > 16) map.setZoom(16); // Evita zoom excessivo
                           }
                       } else if (currentUserLocation) {
                           map.setCenter(currentUserLocation); // Centraliza no usuário se não houver marcadores
                           map.setZoom(15); // Zoom padrão
                       }
                    }
                } catch (e) { console.error("   Erro ao disparar resize/fitBounds do mapa:", e); }
            }, 150); // Aumentado ligeiramente o delay para garantir renderização CSS

        });
    } else {
         // Log se algum elemento essencial para o botão Voltar não foi encontrado
         if (!backButton) console.error("Setup Listener Voltar: Botão #back-button não encontrado.");
         if (!appContainer) console.error("Setup Listener Voltar: #appContainer não encontrado.");
         if (!routeFoundBtn) console.error("Setup Listener Voltar: #route-found-btn não encontrado.");
    }
    // *******************************************************************
    // ***** FIM: LÓGICA DO BOTÃO VOLTAR *****
    // *******************************************************************

    console.log(">>> setupEventListeners: Concluído.");
} // --- FIM DA FUNÇÃO setupEventListeners ---


// addPlaceToList (Exatamente como no script base funcional)
function addPlaceToList(name, address, placeId) { /* ...código original sem alterações... */ }

// handleSearchResults (Exatamente como no script base funcional)
function handleSearchResults(results, status) { /* ...código original sem alterações... */ }

// clearFoundMarkers (Exatamente como no script base funcional - Limpa TUDO)
function clearFoundMarkers() { /* ...código original sem alterações... */ }

// Chamada inicial (Exatamente como no script base funcional)
console.log("Aguardando API do Google Maps chamar initMap...");