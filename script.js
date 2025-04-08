// ========================================================================
// Rota Fácil - script.js
// VERSÃO LIMPA E CORRIGIDA - Foco: Seta e Categorias Consistentes
// ========================================================================

// --- Variáveis Globais ---
let map;
let placesService;
let foundMarkers = [];            // Guarda marcadores da busca por categoria
let currentUserLocation = null;   // Guarda coords {lat, lng} do usuário
let userLocationMarker = null;    // Guarda o objeto Marker da SETA do usuário
let userLocationAccuracyCircle = null; // Guarda o objeto Circle da precisão
let watchId = null;               // Guarda o ID do watchPosition

// --- Serviços de Rota (Inicializados depois, se necessário) ---
let directionsService = null;
let directionsRenderer = null;

// --- Elementos da UI (Inicializados em setupEventListeners) ---
let appContainer = null;
let routeFoundBtn = null;
// ... (outros elementos podem ser adicionados aqui se precisarem ser globais)

// --- Reset Inicial Garantido das Variáveis de Estado ---
userLocationMarker = null;
userLocationAccuracyCircle = null;
if (navigator.geolocation && typeof watchId !== 'undefined' && watchId !== null) {
    console.log(">>> Script Init: Limpando watchId pré-existente:", watchId);
    try { navigator.geolocation.clearWatch(watchId); } catch (e) { console.error(">>> Script Init: Erro ao limpar watchId:", e); }
}
watchId = null;
foundMarkers = [];
console.log(">>> Script Init: Variáveis de estado resetadas.");
// -------------------------------------------------------

/**
 * Cria/Atualiza o marcador de SETA AZUL e círculo de precisão do usuário.
 */
function updateUserMarkerAndAccuracy(position) {
    console.log(">>> updateUserMarkerAndAccuracy: INÍCIO.");

    if (!position || !position.coords) { console.warn(">>> updateUserMarkerAndAccuracy: Posição inválida."); return; }
    if (!map || typeof map.setCenter !== 'function') { console.error(">>> updateUserMarkerAndAccuracy: Mapa inválido!"); return; }

    const pos = { lat: position.coords.latitude, lng: position.coords.longitude };
    const accuracy = position.coords.accuracy;
    const heading = position.coords.heading;
    currentUserLocation = pos; // Atualiza global

    console.log(">>> updateUserMarkerAndAccuracy: Atualizando círculo...");
    // --- Círculo de Precisão ---
    try {
        if (userLocationAccuracyCircle) {
            userLocationAccuracyCircle.setCenter(pos); userLocationAccuracyCircle.setRadius(accuracy);
        } else {
            userLocationAccuracyCircle = new google.maps.Circle({ map: map, center: pos, radius: accuracy, strokeColor: '#1a73e8', strokeOpacity: 0.4, strokeWeight: 1, fillColor: '#1a73e8', fillOpacity: 0.1, zIndex: 1 });
        }
    } catch(circleError) { console.error("!!! ERRO Círculo:", circleError); }

    console.log(">>> updateUserMarkerAndAccuracy: Preparando ícone da SETA AZUL...");
    // --- Marcador de Seta Azul ---
    let iconConfig = {
        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, fillColor: '#1a73e8', fillOpacity: 1,
        strokeColor: '#ffffff', strokeWeight: 2, scale: 6, anchor: new google.maps.Point(0, 2.5), rotation: 0
    };
    if (heading !== null && !isNaN(heading) && typeof heading === 'number') { iconConfig.rotation = heading; }

    try {
        if (userLocationMarker) { // Atualiza existente
            console.log(">>> updateUserMarkerAndAccuracy: Atualizando SETA existente...");
            userLocationMarker.setIcon(iconConfig); // Tenta ícone primeiro
            userLocationMarker.setPosition(pos);
            if(userLocationMarker.getMap() == null) { userLocationMarker.setMap(map); console.warn(">>> updateUserMarkerAndAccuracy: Seta readicionada ao mapa."); }
            console.log(">>> updateUserMarkerAndAccuracy: Seta ATUALIZADA.");
        } else { // Cria nova
            console.log(">>> updateUserMarkerAndAccuracy: Criando NOVA SETA...");
            userLocationMarker = new google.maps.Marker({ position: pos, map: map, title: 'Sua localização', icon: iconConfig, zIndex: 2 });
            console.log(">>> updateUserMarkerAndAccuracy: NOVA SETA CRIADA.");
        }
    } catch (markerError) { console.error("!!! ERRO Marcador/Seta:", markerError); userLocationMarker = null; }

    console.log(">>> updateUserMarkerAndAccuracy: FIM.");
}

/**
 * Lida com erros da API de Geolocalização.
 */
function handleLocationError(error, isWatching) {
    let prefix = isWatching ? 'Erro Watch' : 'Erro Get';
    let message = `${prefix}: ${error.message} (Code: ${error.code})`;
    console.warn(message);

    if (isWatching && error.code === error.PERMISSION_DENIED) {
       console.warn(">>> handleLocationError: Permissão negada durante watch. Limpando marcador/círculo/watch.");
       if (userLocationMarker) { try { userLocationMarker.setMap(null); } catch(e){} userLocationMarker = null; }
       if (userLocationAccuracyCircle) { try { userLocationAccuracyCircle.setMap(null); } catch(e){} userLocationAccuracyCircle = null; }
       if (watchId !== null) { try { navigator.geolocation.clearWatch(watchId); } catch(e){} watchId = null; }
    }
}

/**
 * Callback principal chamado pela API do Google Maps.
 */
function initMap() {
    console.log(">>> initMap: Iniciando...");

    // Garante que marcador/círculo comecem nulos nesta sessão
    userLocationMarker = null;
    userLocationAccuracyCircle = null;
    console.log(">>> initMap: Marcador/Círculo resetados para null.");

    if (navigator.geolocation) {
        console.log(">>> initMap: Tentando obter localização inicial...");
        navigator.geolocation.getCurrentPosition(
            (position) => { // SUCESSO INICIAL
                console.log(">>> initMap: Localização inicial OBTIDA.");
                currentUserLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
                initializeMapAndServices(currentUserLocation, 15); // Inicializa mapa/serviços
                // Chama update/watcher DEPOIS que mapa/serviços estão prontos (dentro de initializeMapAndServices)
            },
            (error) => { // ERRO INICIAL
                console.warn(">>> initMap: Erro ao obter localização inicial.");
                currentUserLocation = null;
                const defaultCoords = { lat: -23.5505, lng: -46.6333 }; // SP Padrão
                initializeMapAndServices(defaultCoords, 13); // Inicializa mapa/serviços
                handleLocationError(error, false);
                // Chama watcher DEPOIS (dentro de initializeMapAndServices)
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    } else { // Sem suporte a Geo
        console.warn(">>> initMap: Geolocalização não suportada.");
        currentUserLocation = null;
        const defaultCoords = { lat: -23.5505, lng: -46.6333 };
        initializeMapAndServices(defaultCoords, 13);
    }
}

/**
 * Inicia o monitoramento contínuo da localização (watchPosition).
 * CHAMADO DEPOIS que o mapa está pronto.
 */
function startWatchingPosition() {
     if (!navigator.geolocation) { console.warn(">>> startWatchingPosition: Geo não suportada."); return; }
     // Limpa watcher anterior
     if (watchId !== null) {
          console.warn(">>> startWatchingPosition: Limpando watchId anterior:", watchId);
          try { navigator.geolocation.clearWatch(watchId); } catch(e) { console.error(">>> startWatchingPosition: Erro ao limpar watchId anterior:", e); }
          watchId = null;
     }
     console.log(">>> startWatchingPosition: Tentando iniciar...");
     try {
         watchId = navigator.geolocation.watchPosition(
             (newPosition) => { // SUCESSO no watch
                 console.log("--- watchPosition: Sucesso. Chamando update...");
                 updateUserMarkerAndAccuracy(newPosition); // Chama a função da seta
             },
             (error) => { // ERRO no watch
                 console.error("!!! watchPosition: ERRO recebido:", error.code, error.message);
                 handleLocationError(error, true);
             },
             { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 } // Opções
         );
         console.log(`>>> startWatchingPosition: Iniciado com watchId: ${watchId}`);
     } catch (watchError) { console.error("!!! ERRO GERAL ao iniciar watchPosition:", watchError); watchId = null; }
 }

/**
 * Inicializa o mapa, PlacesService e chama outras inicializações.
 */
function initializeMapAndServices(initialCoords, initialZoom) {
    console.log(">>> initializeMapAndServices: Iniciando...");
    const mapDiv = document.getElementById('map-container');
    if (!mapDiv) { console.error("!!! ERRO CRÍTICO: #map-container não encontrado!"); return; }
    const loadingP = mapDiv.querySelector('p'); if (loadingP) loadingP.remove();

    try {
        console.log(">>> initializeMapAndServices: Criando mapa...");
        map = new google.maps.Map(mapDiv, { center: initialCoords, zoom: initialZoom }); // Sem mapId por enquanto
        console.log(">>> initializeMapAndServices: Mapa criado. Criando PlacesService...");
        placesService = new google.maps.places.PlacesService(map);
        console.log(">>> initializeMapAndServices: PlacesService criado.");

        // Inicializa outros serviços (Directions) - NECESSÁRIO PARA A ROTA DEPOIS
        console.log(">>> initializeMapAndServices: Criando DirectionsService/Renderer...");
        directionsService = new google.maps.DirectionsService();
        directionsRenderer = new google.maps.DirectionsRenderer({ map: map, suppressMarkers: false }); // Mostra A/B
        console.log(">>> initializeMapAndServices: Directions criados.");

        console.log(">>> initializeMapAndServices: Serviços Google prontos.");

        // Chama setup dos listeners DEPOIS que tudo está pronto
        setupEventListeners();

        // Chama update da seta com a localização inicial (se disponível) DEPOIS que mapa está pronto
        if (currentUserLocation) {
             console.log(">>> initializeMapAndServices: Chamando update inicial da seta...");
             // Simula um objeto position para a função
             const initialPositionLike = { coords: { latitude: currentUserLocation.lat, longitude: currentUserLocation.lng, accuracy: 20, heading: null } };
             updateUserMarkerAndAccuracy(initialPositionLike);
        }

        // Inicia o watchPosition DEPOIS que mapa está pronto
        startWatchingPosition();


    } catch (error) {
        console.error("!!! ERRO GERAL em initializeMapAndServices:", error);
        if (mapDiv) { mapDiv.innerHTML = `<p style="color: red; padding: 20px;">ERRO: ${error.message}</p>`; }
    }
}

/**
 * Configura TODOS os listeners de eventos necessários.
 */
function setupEventListeners() {
    console.log(">>> setupEventListeners: Configurando...");

    // Pega referências DEPOIS que o mapa (e DOM) devem estar prontos
    appContainer = document.getElementById('app-container');
    const backButton = document.getElementById('back-button');
    const searchInput = document.getElementById('search-input');
    const addLocationBtn = document.getElementById('add-location-btn');
    const selectedLocationsList = document.getElementById('selected-locations-list');
    const categoryButtons = document.querySelectorAll('.category-btn');
    routeFoundBtn = document.getElementById('route-found-btn'); // Atribui à variável global

    // Verifica elementos essenciais
    let missingElement = null;
    if (!appContainer) missingElement = '#app-container';
    else if (!searchInput) missingElement = '#search-input';
    else if (!addLocationBtn) missingElement = '#add-location-btn';
    else if (!selectedLocationsList) missingElement = '#selected-locations-list';
    else if (!categoryButtons || categoryButtons.length === 0) missingElement = '.category-btn';
    else if (!routeFoundBtn) missingElement = '#route-found-btn';
    if (missingElement) { console.error(`ERRO FATAL: Elemento "${missingElement}" não encontrado!`); return; }
    if (!backButton) { console.warn("AVISO: Botão #back-button não encontrado."); }

    // --- Configuração Autocomplete (SIMPLIFICADO) ---
    // ... (código do autocomplete como antes) ...
    setTimeout(() => { /* ... código autocomplete ... */ }, 500);


    // --- Listener Botões de Categoria ---
    categoryButtons.forEach(button => {
        button.addEventListener('click', function() {
            const categoryType = this.dataset.category;
            console.log(`>>> CATEGORIA CLICADA: "${categoryType}" <<<`);
            if (!map || !placesService || typeof placesService.nearbySearch !== 'function') {
                alert("Mapa/Places não pronto!"); console.error("Busca categoria: Dependências inválidas."); return;
            }
            console.log(`--- Iniciando busca para "${categoryType}" ---`);
            if(routeFoundBtn) routeFoundBtn.disabled = true;
            clearFoundMarkers(); // Limpa anteriores

            let request;
            if (currentUserLocation) {
                console.log("--- Buscando perto (nearbySearch) ---");
                request = { location: currentUserLocation, radius: 5000, keyword: categoryType };
                placesService.nearbySearch(request, handleSearchResults);
            } else {
                console.log("--- Buscando na área visível (textSearch) ---");
                if (!map.getBounds()) { alert("Área do mapa indefinida."); return; }
                request = { bounds: map.getBounds(), query: categoryType };
                placesService.textSearch(request, handleSearchResults);
            }
        });
    });

    // --- Listener Botão "Traçar Rota" (FUNCIONALIDADE DESATIVADA) ---
     if (routeFoundBtn) {
         routeFoundBtn.addEventListener('click', function() {
             alert("Funcionalidade 'Traçar Rota' será reativada na próxima etapa.");
             console.log("Botão Traçar Rota clicado (funcionalidade pendente).");
             // Futuro: Reintroduzir lógica de getCurrentPosition, limite de waypoints,
             // directionsService.route, e ativação do modo mapa.
         });
     }

     // --- Listeners Manuais (FUNCIONALIDADE DESATIVADA) ---
     if (addLocationBtn) { addLocationBtn.addEventListener('click', () => { alert("Adicionar manual desativado."); }); }
     if (selectedLocationsList) { /* ... listener remover desativado ... */ }

    // --- Listener Botão Voltar (FUNCIONALIDADE DESATIVADA) ---
    if (backButton && appContainer) {
        backButton.addEventListener('click', () => {
             alert("Botão Voltar será reativado na próxima etapa.");
             console.log("Botão Voltar clicado (funcionalidade pendente).");
            // Futuro: Reintroduzir lógica de remover classe, limpar rota, redimensionar.
        });
    }

    console.log(">>> setupEventListeners: Concluído.");
} // --- FIM DA FUNÇÃO setupEventListeners ---


/**
 * Callback para processar resultados da busca por categoria.
 * Adiciona marcadores SIMPLES (pinos padrão).
 */
function handleSearchResults(results, status) {
    console.log(`>>> handleSearchResults: Status: "${status}". Resultados:`, results ? results.length : 0);

    clearFoundMarkers(); // Limpa DE NOVO antes de adicionar (garantia extra)

    if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
        let bounds = new google.maps.LatLngBounds();
        let validCount = 0;
        results.forEach((place, index) => {
            if (place.name && place.geometry && place.geometry.location) {
                console.log(`   - Adicionando Marcador ${index + 1}: ${place.name}`);
                try {
                     // Usa marcador PADRÃO por enquanto
                     const marker = new google.maps.Marker({ position: place.geometry.location, map: map, title: place.name });
                     foundMarkers.push(marker);
                     bounds.extend(place.geometry.location);
                     validCount++;
                } catch(e) { console.error(`Erro ao criar marcador para ${place.name}:`, e); }
            } else { console.log(`   - Resultado ${index + 1}: Inválido.`); }
        });

        if (validCount > 0) {
             console.log(`>>> handleSearchResults: ${validCount} marcadores adicionados.`);
             if (currentUserLocation) bounds.extend(currentUserLocation);
             map.fitBounds(bounds); if (map.getZoom() > 16) map.setZoom(16);
             if (routeFoundBtn) routeFoundBtn.disabled = false; console.log(">>> handleSearchResults: Botão Traçar Rota HABILITADO.");
        } else { /* ... nenhum válido ... */ }
    } else { /* ... erro ou zero resultados ... */ }
    console.log(">>> handleSearchResults: FIM.");
}

/**
 * Limpa marcadores da busca por categoria e desabilita botão Traçar Rota.
 */
function clearFoundMarkers() {
    console.log(`>>> clearFoundMarkers: Iniciando limpeza. ${foundMarkers ? `Limpando ${foundMarkers.length} marcadores.` : 'Array inválido.'}`);
    if (foundMarkers && Array.isArray(foundMarkers) && foundMarkers.length > 0) {
         try {
              foundMarkers.forEach((marker) => { if (marker && typeof marker.setMap === 'function') { marker.setMap(null); } });
              console.log(`>>> clearFoundMarkers: Marcadores removidos.`);
         } catch (e) { console.error(`>>> clearFoundMarkers: Erro ao remover:`, e); }
    }
    foundMarkers = []; // Reseta o array para vazio
    if (routeFoundBtn) { routeFoundBtn.disabled = true; } // Garante desabilitar botão
    console.log(`>>> clearFoundMarkers: Limpeza concluída.`);
}

// Chamada inicial (via callback da API do Google Maps)
console.log("Aguardando API do Google Maps chamar initMap...");