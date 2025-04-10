// ========================================================================
// Rota Fácil - script.js
// VERSÃO BASE + ADD MANUAL + BOTÃO VOLTAR REATIVADO (Completo)
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

// --- Reset Inicial (Como no script funcional anterior) ---
userLocationMarker = null; userLocationAccuracyCircle = null;
if (navigator.geolocation && typeof watchId !== 'undefined' && watchId !== null) { try { navigator.geolocation.clearWatch(watchId); } catch (e) { console.error(">>> Script Init: Erro ao limpar watchId:", e); } }
watchId = null; foundMarkers = []; console.log(">>> Script Init: Resetado.");
// -------------------------------------------------------

// updateUserMarkerAndAccuracy (Como no script funcional anterior)
function updateUserMarkerAndAccuracy(position) {
    console.log(">>> updateUserMarkerAndAccuracy: INÍCIO.");
    if (!position || !position.coords) { console.warn(">>> updateUserMarkerAndAccuracy: Posição inválida."); return; }
    if (!map || typeof map.setCenter !== 'function' || typeof map.getProjection !== 'function') { console.error(">>> updateUserMarkerAndAccuracy: Mapa inválido!"); return; }
    const pos = { lat: position.coords.latitude, lng: position.coords.longitude }; currentUserLocation = pos;
    const accuracy = position.coords.accuracy; const heading = position.coords.heading; console.log(">>> updateUserMarkerAndAccuracy: Mapa e posição OK.");
    const performVisualUpdate = () => {
        console.log(">>> updateUserMarkerAndAccuracy (performVisualUpdate): Executando...");
        try { if (userLocationAccuracyCircle) { userLocationAccuracyCircle.setCenter(pos); userLocationAccuracyCircle.setRadius(accuracy); } else { userLocationAccuracyCircle = new google.maps.Circle({ map: map, center: pos, radius: accuracy, strokeColor: '#1a73e8', strokeOpacity: 0.4, strokeWeight: 1, fillColor: '#1a73e8', fillOpacity: 0.1, zIndex: 1 }); } } catch(circleError) { console.error("!!! ERRO Círculo:", circleError); }
        let iconConfig = { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, fillColor: '#1a73e8', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2, scale: 6, anchor: new google.maps.Point(0, 2.5), rotation: 0 };
        if (heading !== null && !isNaN(heading) && typeof heading === 'number') { iconConfig.rotation = heading; }
        try { if (userLocationMarker) { userLocationMarker.setIcon(iconConfig); userLocationMarker.setPosition(pos); if (userLocationMarker.getMap() !== map) { userLocationMarker.setMap(map); } } else { userLocationMarker = new google.maps.Marker({ position: pos, map: map, title: 'Sua localização', icon: iconConfig, zIndex: 2 }); } } catch (markerError) { console.error("!!! ERRO Marcador/Seta:", markerError); userLocationMarker = null; }
        console.log(">>> updateUserMarkerAndAccuracy (performVisualUpdate): FIM.");
    };
    if (map.getProjection()) { performVisualUpdate(); } else { console.warn(">>> updateUserMarkerAndAccuracy: Mapa não pronto, aguardando 'tilesloaded'..."); const listener = google.maps.event.addListenerOnce(map, 'tilesloaded', performVisualUpdate); setTimeout(() => { if (listener && (!userLocationMarker || !userLocationMarker.getMap())) { google.maps.event.removeListener(listener); performVisualUpdate(); } }, 3000); }
    console.log(">>> updateUserMarkerAndAccuracy: FIM.");
}

// handleLocationError (Como no script funcional anterior)
function handleLocationError(error, isWatching) {
    let prefix = isWatching ? 'Erro Watch' : 'Erro Get'; let message = `${prefix}: ${error.message} (Code: ${error.code})`; console.warn(message);
    if (isWatching && error.code === error.PERMISSION_DENIED) { console.warn(">>> handleLocationError: Permissão negada no watch. Limpando."); if (userLocationMarker) { try { userLocationMarker.setMap(null); } catch(e){} userLocationMarker = null; } if (userLocationAccuracyCircle) { try { userLocationAccuracyCircle.setMap(null); } catch(e){} userLocationAccuracyCircle = null; } if (watchId !== null) { try { navigator.geolocation.clearWatch(watchId); } catch(e){} watchId = null; } }
}

// initMap (Como no script funcional anterior)
function initMap() {
    console.log(">>> initMap: Iniciando..."); userLocationMarker = null; userLocationAccuracyCircle = null; console.log(">>> initMap: Marcador/Círculo resetados.");
    if (navigator.geolocation) {
        console.log(">>> initMap: Tentando obter localização inicial...");
        navigator.geolocation.getCurrentPosition(
            (position) => { console.log(">>> initMap: Localização inicial OBTIDA."); currentUserLocation = { lat: position.coords.latitude, lng: position.coords.longitude }; initializeMapAndServices(currentUserLocation, 15); },
            (error) => { console.warn(">>> initMap: Erro localização inicial."); currentUserLocation = null; const defaultCoords = { lat: -23.5505, lng: -46.6333 }; initializeMapAndServices(defaultCoords, 13); handleLocationError(error, false); },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    } else { console.warn(">>> initMap: Geolocalização não suportada."); currentUserLocation = null; const defaultCoords = { lat: -23.5505, lng: -46.6333 }; initializeMapAndServices(defaultCoords, 13); }
}

// startWatchingPosition (Como no script funcional anterior)
function startWatchingPosition() {
     if (!navigator.geolocation) { console.warn(">>> startWatchingPosition: Geo não suportada."); return; }
     if (watchId !== null) { try { navigator.geolocation.clearWatch(watchId); } catch(e) { console.error("Erro ao limpar watchId:", e); } watchId = null; }
     console.log(">>> startWatchingPosition: Tentando iniciar...");
     try {
         watchId = navigator.geolocation.watchPosition( (newPosition) => { updateUserMarkerAndAccuracy(newPosition); }, (error) => { console.error("!!! watchPosition: ERRO:", error.code, error.message); handleLocationError(error, true); }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 } );
         console.log(`>>> startWatchingPosition: Iniciado com watchId: ${watchId}`);
     } catch (watchError) { console.error("!!! ERRO GERAL ao iniciar watchPosition:", watchError); watchId = null; }
 }

// initializeMapAndServices (Como no script funcional anterior)
function initializeMapAndServices(initialCoords, initialZoom) {
    console.log(">>> initializeMapAndServices: Iniciando...");
    const mapDiv = document.getElementById('map-container'); if (!mapDiv) { console.error("!!! ERRO CRÍTICO: #map-container não encontrado!"); return; }
    const loadingP = mapDiv.querySelector('p'); if (loadingP) loadingP.remove();
    try {
        console.log(">>> initializeMapAndServices: Criando mapa..."); map = new google.maps.Map(mapDiv, { center: initialCoords, zoom: initialZoom }); console.log(">>> initializeMapAndServices: Mapa criado.");
        placesService = new google.maps.places.PlacesService(map); console.log(">>> initializeMapAndServices: PlacesService criado.");
        directionsService = new google.maps.DirectionsService(); directionsRenderer = new google.maps.DirectionsRenderer({ map: map, suppressMarkers: false }); console.log(">>> initializeMapAndServices: Directions criados.");
        console.log(">>> initializeMapAndServices: Serviços Google prontos.");
        setupEventListeners(); // Chama listeners DEPOIS
        if (currentUserLocation) { const initialPositionLike = { coords: { latitude: currentUserLocation.lat, longitude: currentUserLocation.lng, accuracy: 20, heading: null } }; updateUserMarkerAndAccuracy(initialPositionLike); }
        startWatchingPosition(); // Inicia watch DEPOIS
    } catch (error) { console.error("!!! ERRO GERAL em initializeMapAndServices:", error); if (mapDiv) { mapDiv.innerHTML = `<p style="color: red;">ERRO: ${error.message}</p>`; } }
}


/**
 * Configura TODOS os listeners de eventos necessários.
 * >>> FOCO: Reativar lógica do Botão Voltar <<<
 */
function setupEventListeners() {
    console.log(">>> setupEventListeners: Configurando...");

    // Pega referências
    appContainer = document.getElementById('app-container');
    backButton = document.getElementById('back-button'); // <<< ESSENCIAL
    searchInput = document.getElementById('search-input'); addLocationBtn = document.getElementById('add-location-btn'); selectedLocationsList = document.getElementById('selected-locations-list');
    const categoryButtons = document.querySelectorAll('.category-btn'); routeFoundBtn = document.getElementById('route-found-btn');

    // Verifica elementos essenciais (backButton é essencial agora)
    let missingElement = null;
    if (!appContainer) missingElement = '#app-container'; else if (!searchInput) missingElement = '#search-input'; else if (!addLocationBtn) missingElement = '#add-location-btn'; else if (!selectedLocationsList) missingElement = '#selected-locations-list'; else if (!categoryButtons || categoryButtons.length === 0) missingElement = '.category-btn'; else if (!routeFoundBtn) missingElement = '#route-found-btn'; else if (!backButton) missingElement = '#back-button'; // <<< VERIFICAÇÃO ESSENCIAL
    if (missingElement) { console.error(`ERRO FATAL: Elemento "${missingElement}" não encontrado!`); return; }


    // --- Listener Botões de Categoria (Como no script funcional anterior) ---
    categoryButtons.forEach(button => {
        button.addEventListener('click', function() {
            const categoryType = this.dataset.category; console.log(`>>> CATEGORIA CLICADA: "${categoryType}" <<<`); if (!map || !placesService) { alert("Mapa/Places não pronto!"); return; }
            console.log(`--- Iniciando busca por categoria "${categoryType}" ---`); if(routeFoundBtn) routeFoundBtn.disabled = true;
            clearFoundMarkers(); // Limpa TUDO (manuais incluídos) e lista UL
            let request; if (currentUserLocation) { request = { location: currentUserLocation, radius: 5000, keyword: categoryType }; placesService.nearbySearch(request, handleSearchResults); } else { const bounds = map.getBounds(); if (!bounds) { alert("Área do mapa indefinida."); return; } request = { bounds: bounds, query: categoryType }; placesService.textSearch(request, handleSearchResults); }
        });
    });

    // --- Listener Botão "Traçar Rota" (Como no script funcional anterior) ---
    // Este listener já adiciona 'map-only-mode' e guarda currentRouteResult/Request
    if (routeFoundBtn) {
        routeFoundBtn.addEventListener('click', function() {
            console.log(`>>> [Traçar Rota Clicado] Iniciando. Total de locais: ${foundMarkers.length}`);
             if (!directionsService || !directionsRenderer) { alert("ERRO: Serviço de rotas não pronto."); return; } if (!foundMarkers || foundMarkers.length === 0) { alert("Nenhum local encontrado ou adicionado para a rota."); return; } if (!map) { alert("ERRO: Mapa não está pronto."); return; }
             this.disabled = true; this.textContent = "Localizando...";
             if (navigator.geolocation) {
                 navigator.geolocation.getCurrentPosition(
                     (position) => {
                         this.textContent = "Calculando Rota..."; const userPos = { lat: position.coords.latitude, lng: position.coords.longitude }; currentUserLocation = userPos; updateUserMarkerAndAccuracy(position);
                         if (directionsRenderer) directionsRenderer.setDirections({ routes: [] });
                         const MAX_ALLOWED_WAYPOINTS = 10; const markersForRoute = foundMarkers.slice(0, MAX_ALLOWED_WAYPOINTS + 1); const waypointsLimited = markersForRoute.map(m => ({ location: m.getPosition(), stopover: true }));
                         let originPoint = userPos; let destinationPoint; let waypointsForRequest = [];
                         if (waypointsLimited.length === 0) { alert("Erro interno: Nenhum marcador válido."); this.disabled = false; this.textContent = "Traçar Rota"; return; } else if (waypointsLimited.length === 1) { destinationPoint = waypointsLimited[0].location; } else { destinationPoint = waypointsLimited[waypointsLimited.length - 1].location; waypointsForRequest = waypointsLimited.slice(0, -1); }
                         const request = { origin: originPoint, destination: destinationPoint, waypoints: waypointsForRequest, optimizeWaypoints: true, travelMode: google.maps.TravelMode.DRIVING };
                         directionsService.route(request, (result, status) => {
                             if (status === google.maps.DirectionsStatus.OK) {
                                 directionsRenderer.setDirections(result); currentRouteResult = result; currentRouteRequest = request; isRecalculating = false; // Guarda estado
                                 if (appContainer) { appContainer.classList.add('map-only-mode'); setTimeout(() => { if (map) { google.maps.event.trigger(map, 'resize'); if (result.routes[0].bounds) { map.fitBounds(result.routes[0].bounds); } } }, 350); }
                                 this.textContent = "Rota Traçada";
                             } else { alert(`Não foi possível calcular a rota: ${status}.`); currentRouteResult = null; currentRouteRequest = null; this.disabled = foundMarkers.length === 0; this.textContent = "Traçar Rota"; }
                         });
                     }, (error) => { alert("Não foi possível obter sua localização para traçar a rota."); this.disabled = foundMarkers.length === 0; this.textContent = "Traçar Rota"; handleLocationError(error, false); }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
                 );
             } else { alert("Geolocalização não suportada."); this.disabled = foundMarkers.length === 0; this.textContent = "Traçar Rota"; }
        });
    }

    // --- Listener Botão Adicionar Manual (Ação desativada - como no script funcional anterior) ---
    if (addLocationBtn) { addLocationBtn.addEventListener('click', () => { console.log("Ação via seleção do Autocomplete."); }); }

    // --- Código Autocomplete e Remoção Manual (Como no script funcional anterior) ---
    setTimeout(() => {
        if (searchInput && map && typeof google !== 'undefined' && google.maps && google.maps.places) {
            try {
                autocomplete = new google.maps.places.Autocomplete(searchInput, { componentRestrictions: { country: "br" }, fields: ["place_id", "geometry", "name", "formatted_address"] }); autocomplete.bindTo('bounds', map);
                autocomplete.addListener('place_changed', () => {
                    const place = autocomplete.getPlace(); if (!place.geometry || !place.geometry.location) return;
                    const alreadyExists = foundMarkers.some(marker => marker.placeId === place.place_id); if (alreadyExists) { alert(`"${place.name}" já adicionado.`); searchInput.value = ''; return; }
                    const manualMarker = new google.maps.Marker({ map: map, position: place.geometry.location, title: place.name }); manualMarker.placeId = place.place_id;
                    foundMarkers.push(manualMarker); addPlaceToList(place.name, place.formatted_address, manualMarker.placeId);
                    map.panTo(place.geometry.location); searchInput.value = ''; if (routeFoundBtn) routeFoundBtn.disabled = false;
                });
            } catch (e) { console.error("ERRO Autocomplete:", e); }
        } else { console.error("Autocomplete não iniciado."); }
    }, 1500);
    if (selectedLocationsList) {
        selectedLocationsList.addEventListener('click', function(event) {
            if (event.target && event.target.classList.contains('remove-btn')) {
                const listItem = event.target.closest('li'); const placeIdToRemove = listItem.dataset.placeId; if (!placeIdToRemove) return;
                let markerIndex = foundMarkers.findIndex(marker => marker.placeId === placeIdToRemove);
                if (markerIndex > -1) { foundMarkers[markerIndex].setMap(null); foundMarkers.splice(markerIndex, 1); listItem.remove(); if (routeFoundBtn) routeFoundBtn.disabled = foundMarkers.length === 0; } else { listItem.remove(); }
            }
        });
    }

    // *******************************************************************
    // ***** INÍCIO: LÓGICA DO BOTÃO VOLTAR REATIVADA *****
    // *******************************************************************
    // A lógica que estava comentada ou com alert foi substituída pela lógica funcional.
    if (backButton && appContainer && routeFoundBtn) {
        backButton.addEventListener('click', () => {
            console.log(">>> Botão Voltar (Mapa) clicado.");

            // 1. Limpar a rota visualmente
            if (directionsRenderer) { try { directionsRenderer.setDirections({ routes: [] }); console.log("   Rota visual limpa."); } catch (e) { console.error("   Erro ao limpar directionsRenderer:", e); } } else { console.warn("   directionsRenderer não disponível."); }

            // 2. Remover o modo "mapa apenas"
            if (appContainer) { appContainer.classList.remove('map-only-mode'); console.log("   Classe 'map-only-mode' removida."); }

            // 3. Resetar o botão "Traçar Rota"
            if (routeFoundBtn) { routeFoundBtn.textContent = "Traçar Rota"; routeFoundBtn.disabled = foundMarkers.length === 0; console.log(`   Botão 'Traçar Rota' resetado. Habilitado: ${!routeFoundBtn.disabled}`); }

            // 4. Limpar variáveis de estado da rota
            currentRouteResult = null; currentRouteRequest = null; isRecalculating = false; console.log("   Variáveis de estado da rota limpas.");

            // 5. Disparar redimensionamento e reajuste do mapa
            setTimeout(() => {
                try {
                    if (map) {
                       google.maps.event.trigger(map, 'resize'); console.log("   Evento 'resize' do mapa disparado.");
                       if (foundMarkers.length > 0) { // Reajusta zoom para marcadores
                           let bounds = new google.maps.LatLngBounds(); if (currentUserLocation) bounds.extend(currentUserLocation);
                           foundMarkers.forEach(marker => { if (marker.getMap() === map) bounds.extend(marker.getPosition()); });
                           if (!bounds.isEmpty()) { map.fitBounds(bounds); const listener = google.maps.event.addListenerOnce(map, 'idle', () => { if (map.getZoom() > 16) map.setZoom(16); }); setTimeout(() => google.maps.event.removeListener(listener), 1000); }
                       } else if (currentUserLocation) { map.setCenter(currentUserLocation); map.setZoom(15); } // Volta para usuário
                    }
                } catch (e) { console.error("   Erro ao disparar resize/fitBounds do mapa:", e); }
            }, 150);
        });
    } else { // Logs de erro se elementos essenciais faltarem
         if (!backButton) console.error("Setup Listener Voltar: Botão #back-button não encontrado."); if (!appContainer) console.error("Setup Listener Voltar: #appContainer não encontrado."); if (!routeFoundBtn) console.error("Setup Listener Voltar: #route-found-btn não encontrado.");
    }
    // *******************************************************************
    // ***** FIM: LÓGICA DO BOTÃO VOLTAR *****
    // *******************************************************************

    console.log(">>> setupEventListeners: Concluído.");
} // --- FIM DA FUNÇÃO setupEventListeners ---


// addPlaceToList (Como no script funcional anterior)
function addPlaceToList(name, address, placeId) {
    if (!selectedLocationsList || !placeId) { console.error("addPlaceToList: Lista UL ou placeId inválido."); return; }
    const listItem = document.createElement('li'); listItem.dataset.placeId = placeId;
    let displayText = name; if (address) { let shortAddress = address.split(',')[0]; if (shortAddress.toLowerCase() !== name.toLowerCase()) { displayText += ` (${shortAddress})`; } }
    listItem.textContent = displayText;
    const removeButton = document.createElement('button'); removeButton.textContent = 'X'; removeButton.classList.add('remove-btn');
    removeButton.style.cssText = 'margin-left: 8px; padding: 2px 5px; font-size: 0.8em; cursor: pointer; color: red; border: 1px solid red; background: none;'; // Estilos inline
    listItem.appendChild(removeButton); selectedLocationsList.appendChild(listItem); console.log(`   Item adicionado à lista UL: ${name}`);
}

// handleSearchResults (Como no script funcional anterior)
function handleSearchResults(results, status) {
    console.log(`>>> handleSearchResults (Categoria): Status: "${status}". Resultados:`, results ? results.length : 0);
    if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
        let bounds = new google.maps.LatLngBounds(); let validCount = 0;
        results.forEach((place, index) => { if (place.name && place.geometry && place.geometry.location) { try { const categoryMarker = new google.maps.Marker({ position: place.geometry.location, map: map, title: place.name }); foundMarkers.push(categoryMarker); bounds.extend(place.geometry.location); validCount++; } catch(e) { console.error(`Erro marcador categoria ${place.name}:`, e); } } });
        if (validCount > 0) {
             console.log(`>>> handleSearchResults (Categoria): ${validCount} marcadores adicionados.`); if (currentUserLocation) bounds.extend(currentUserLocation);
             foundMarkers.forEach(marker => { if (marker.getMap() === map) { bounds.extend(marker.getPosition()); } }); // Inclui manuais nos bounds
             if (!bounds.isEmpty()) { try { map.fitBounds(bounds); if (map.getZoom() > 16) map.setZoom(16); } catch (e) { console.error("Erro fitBounds/setZoom (Categoria):", e); } }
             if (routeFoundBtn) routeFoundBtn.disabled = false;
        } else { if (routeFoundBtn) routeFoundBtn.disabled = foundMarkers.length === 0; }
    } else { if (routeFoundBtn) routeFoundBtn.disabled = foundMarkers.length === 0; console.warn(`>>> handleSearchResults (Categoria): Sem resultados ou erro. Status: ${status}.`); }
    console.log(">>> handleSearchResults (Categoria): FIM.");
}

// clearFoundMarkers (Como no script funcional anterior - Limpa TUDO)
function clearFoundMarkers() {
    console.log(`>>> clearFoundMarkers: Limpando ${foundMarkers.length} marcadores.`); if (foundMarkers && foundMarkers.length > 0) { try { foundMarkers.forEach((marker) => { if (marker && marker.setMap) { marker.setMap(null); } }); } catch (e) { console.error(`Erro ao remover marcadores:`, e); } }
    foundMarkers = []; if(selectedLocationsList) { selectedLocationsList.innerHTML = ''; console.log("   Lista visual UL limpa."); }
    if (routeFoundBtn) { routeFoundBtn.disabled = true; } console.log(`>>> clearFoundMarkers: Limpeza concluída.`);
}

// Chamada inicial (Como no script funcional anterior)
console.log("Aguardando API do Google Maps chamar initMap...");