// ========================================================================
// Rota Fácil - script.js
// VERSÃO CORRIGIDA E REESTRUTURADA
// ========================================================================

// Variáveis globais
let map;
let placesService;
let directionsService;
let directionsRenderer;
const markers = []; // Marcadores adicionados manualmente
let foundMarkers = []; // Marcadores encontrados pela busca/tour - INICIALIZA AQUI
let currentUserLocation = null;
let userLocationMarker = null;
let userLocationAccuracyCircle = null;
let watchId = null; // Começa como null
// Variáveis para Recálculo de Rota
let currentRouteResult = null;
let currentRouteRequest = null;
let isRecalculating = false;
const ROUTE_DEVIATION_TOLERANCE = 50;
let selectedPlaceData = null;
// Referência ao container principal (para modo mapa)
let appContainer = null;

// Bloco NOVO (Reset Garantido com try-catch e log final)
// --- Reset Inicial do Watcher (GARANTIDO) ---
if (navigator.geolocation && typeof watchId !== 'undefined' && watchId !== null) {
    console.log(">>> Reset Inicial: Tentando limpar watchId pré-existente:", watchId);
    try { // Adiciona try-catch para clearWatch
         navigator.geolocation.clearWatch(watchId);
         console.log(">>> Reset Inicial: clearWatch executado para watchId:", watchId);
    } catch (e) {
         console.error(">>> Reset Inicial: Erro ao executar clearWatch:", e);
    }
    watchId = null; // Define como null DEPOIS de tentar limpar
} else {
    console.log(">>> Reset Inicial: Nenhum watchId pré-existente ou inválido encontrado para limpar.");
    watchId = null; // Garante que seja null se não entrou no if
}
// Garante que watchId seja ABSOLUTAMENTE null ao iniciar o script, independentemente do que aconteceu acima
watchId = null;
console.log(">>> Reset Inicial: Estado final GARANTIDO de watchId:", watchId);
// --------------------------------------------

/**
 * Cria ou atualiza o marcador de seta e círculo de precisão do usuário.
 * Chamada por getCurrentPosition e watchPosition.
 */
function updateUserMarkerAndAccuracy(position) {
    console.log(">>> updateUserMarkerAndAccuracy: INÍCIO DA FUNÇÃO. Dados recebidos:", position);

    if (!position || !position.coords) {
         console.warn(">>> updateUserMarkerAndAccuracy: Posição inválida recebida. Abortando.");
         return;
    }

    const pos = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
    };
    const accuracy = position.coords.accuracy;
    const heading = position.coords.heading;

    if (!map) {
        console.error(">>> updateUserMarkerAndAccuracy: ERRO - A variável 'map' não está definida!");
        return;
    }
    console.log(">>> updateUserMarkerAndAccuracy: Variável 'map' OK. Verificando círculo...");

    // --- Círculo de Precisão ---
    if (userLocationAccuracyCircle) {
        userLocationAccuracyCircle.setCenter(pos);
        userLocationAccuracyCircle.setRadius(accuracy);
    } else {
        userLocationAccuracyCircle = new google.maps.Circle({
            strokeColor: '#1a73e8', strokeOpacity: 0.4, strokeWeight: 1,
            fillColor: '#1a73e8', fillOpacity: 0.1, map: map,
            center: pos, radius: accuracy, zIndex: 1
        });
    }
    console.log(">>> updateUserMarkerAndAccuracy: Círculo OK. Preparando ícone da seta...");

    // --- Marcador de Seta ---
    let iconConfig = {
        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, fillColor: '#1a73e8', fillOpacity: 1,
        strokeColor: '#ffffff', strokeWeight: 2, scale: 6, anchor: new google.maps.Point(0, 2), rotation: 0
    };

    if (heading !== null && !isNaN(heading) && typeof heading === 'number') {
        iconConfig.rotation = heading;
        console.log(`>>> updateUserMarkerAndAccuracy: Usando rotação ${heading} para a seta.`);
    } else {
        console.log(">>> updateUserMarkerAndAccuracy: Sem rotação válida para a seta.");
    }

    if (userLocationMarker) {
        console.log(">>> updateUserMarkerAndAccuracy: Atualizando seta existente...");
        try {
             userLocationMarker.setPosition(pos);
             userLocationMarker.setIcon(iconConfig);
             console.log(">>> updateUserMarkerAndAccuracy: Seta existente ATUALIZADA.");
        } catch (updateError) {
             console.error("!!! ERRO ao ATUALIZAR seta:", updateError);
        }
    } else {
        console.log(">>> updateUserMarkerAndAccuracy: Criando NOVA seta...");
        try {
             userLocationMarker = new google.maps.Marker({
                 position: pos, map: map, title: 'Sua localização atual', icon: iconConfig, zIndex: 2
             });
             console.log(">>> updateUserMarkerAndAccuracy: NOVA seta CRIADA com sucesso.");
        } catch (createError) {
             console.error("!!! ERRO ao CRIAR nova seta:", createError);
        }
    }

    currentUserLocation = pos; // Atualiza localização global
    console.log(">>> updateUserMarkerAndAccuracy: Variável currentUserLocation atualizada.");

    // --- Verificação de Desvio de Rota ---
    if (currentRouteResult && !isRecalculating && currentUserLocation && currentRouteRequest) { // Adicionado check currentRouteRequest
        let routePath = [];
        try { // Adicionado try-catch para acesso seguro
            currentRouteResult.routes[0].legs.forEach(leg => { leg.steps.forEach(step => { routePath = routePath.concat(step.path); }); });
            const routePolyline = new google.maps.Polyline({ path: routePath });

            if (google.maps.geometry && google.maps.geometry.poly) {
                 const isOnRoute = google.maps.geometry.poly.isLocationOnEdge( currentUserLocation, routePolyline, ROUTE_DEVIATION_TOLERANCE / 100000 );
                if (!isOnRoute) {
                    console.warn(`>>> updateUserMarkerAndAccuracy: Usuário fora da rota (${ROUTE_DEVIATION_TOLERANCE}m). Recalculando...`);
                    isRecalculating = true;
                     const waypointsOriginal = currentRouteRequest.waypoints || [];
                     const newRequest = {
                         origin: currentUserLocation, destination: currentRouteRequest.destination, waypoints: waypointsOriginal,
                         optimizeWaypoints: currentRouteRequest.optimizeWaypoints, travelMode: currentRouteRequest.travelMode
                     };

                    console.log(">>> updateUserMarkerAndAccuracy: Nova requisição para recálculo:", newRequest);
                    directionsService.route(newRequest, (newResult, status) => {
                        if (status === google.maps.DirectionsStatus.OK) {
                            console.log(">>> updateUserMarkerAndAccuracy: Rota recalculada com sucesso!");
                            directionsRenderer.setDirections(newResult);
                            currentRouteResult = newResult; currentRouteRequest = newRequest;
                        } else {
                            console.error(">>> updateUserMarkerAndAccuracy: Erro ao recalcular rota:", status);
                        }
                        setTimeout(() => { isRecalculating = false; console.log(">>> updateUserMarkerAndAccuracy: Flag de recálculo liberada."); }, 5000);
                    });
                }
            } else { console.warn(">>> updateUserMarkerAndAccuracy: Biblioteca 'geometry' não carregada."); }
        } catch(e) { console.error(">>> updateUserMarkerAndAccuracy: Erro ao processar rota para desvio:", e); }
    }
    console.log(">>> updateUserMarkerAndAccuracy: FIM DA FUNÇÃO.");
}

/**
 * Lida com erros da API de Geolocalização.
 */
function handleLocationError(error, isWatching) {
    let prefix = isWatching ? 'Erro ao monitorar localização' : 'Erro ao obter localização inicial';
    let message = `${prefix}: `;
    switch(error.code) {
       case error.PERMISSION_DENIED: message += "Permissão de localização negada."; break;
       case error.POSITION_UNAVAILABLE: message += "Localização indisponível."; break;
       case error.TIMEOUT: message += "Tempo limite esgotado."; break;
       default: message += `Erro desconhecido (código ${error.code}).`; break;
    }
    console.warn(message, error);

    // Limpa watcher e marcador se a permissão for negada durante o monitoramento
    if (isWatching && error.code === error.PERMISSION_DENIED) {
       if (userLocationMarker) { userLocationMarker.setMap(null); userLocationMarker = null; }
       if (userLocationAccuracyCircle) { userLocationAccuracyCircle.setMap(null); userLocationAccuracyCircle = null; }
       if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; console.log("Monitoramento (watchId) parado por negação de permissão."); }
    }
}

/**
 * Função de Callback principal chamada pela API do Google Maps.
 */
function initMap() {
    console.log("Google Maps API carregada, função initMap executada.");

    if (navigator.geolocation) {
        console.log("Navegador suporta Geolocalização. Tentando obter localização inicial...");
        navigator.geolocation.getCurrentPosition(
            (position) => { // SUCESSO INICIAL
                console.log("Localização inicial obtida:", position.coords.latitude, position.coords.longitude);
                const userCoords = { lat: position.coords.latitude, lng: position.coords.longitude };
                initializeMapWithCoords(userCoords, 15); // Inicializa o mapa com coords
                updateUserMarkerAndAccuracy(position); // Cria/atualiza marcador inicial

                // Tenta iniciar o monitoramento contínuo
                startWatchingPosition();

            },
            (error) => { // ERRO INICIAL
                currentUserLocation = null;
                handleLocationError(error, false);
                console.warn("Não foi possível obter localização inicial. Usando São Paulo como padrão.");
                const defaultCoords = { lat: -23.5505, lng: -46.6333 };
                initializeMapWithCoords(defaultCoords, 13); // Inicializa mapa com SP
                // Tenta iniciar o monitoramento mesmo assim (pode funcionar depois)
                startWatchingPosition();
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
        );
    } else {
        currentUserLocation = null;
        console.warn("Navegador não suporta Geolocalização. Usando São Paulo.");
        alert("Seu navegador não suporta Geolocalização.");
        const defaultCoords = { lat: -23.5505, lng: -46.6333 };
        initializeMapWithCoords(defaultCoords, 13); // Inicializa mapa com SP
    }
}

/**
 * Função separada para iniciar o watchPosition.
 */
function startWatchingPosition() {
     if (!navigator.geolocation) {
          console.warn("startWatchingPosition: Geolocalização não suportada, impossível monitorar.");
          return;
     }
     // Limpa qualquer watcher anterior ANTES de iniciar um novo (precaução extra)
     if (watchId !== null) {
          console.warn("startWatchingPosition: Limpando watchId existente antes de iniciar novo:", watchId);
          navigator.geolocation.clearWatch(watchId);
          watchId = null;
     }

     console.log(">>> Tentando iniciar watchPosition...");
     watchId = navigator.geolocation.watchPosition(
         (newPosition) => { // Callback de SUCESSO do watchPosition
             console.log("--- watchPosition Callback: Sucesso! Dados:", newPosition.coords.latitude, newPosition.coords.longitude);
             if (newPosition && newPosition.coords) {
                 console.log("--- watchPosition Callback: Posição válida, chamando updateUserMarkerAndAccuracy.");
                 updateUserMarkerAndAccuracy(newPosition);
             } else {
                 console.warn("--- watchPosition Callback: Recebeu nova posição, mas dados inválidos.", newPosition);
             }
         },
         (error) => { // Callback de ERRO do watchPosition
             console.error("!!! watchPosition Callback: ERRO recebido:", error.code, error.message);
             handleLocationError(error, true); // Chama a função que trata o erro (e pode parar o watch)
         },
         // Opções do watchPosition
         { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
     );
     console.log(`>>> watchPosition chamado. watchId resultante: ${watchId}`);
 }


/**
 * Inicializa o objeto do mapa e os serviços do Google Maps.
 */
function initializeMapWithCoords(coords, zoomLevel) {
    const mapDiv = document.getElementById('map-container');
    if (!mapDiv) {
        console.error("ERRO CRÍTICO: Div 'map-container' não encontrada.");
        alert("Erro crítico: Container do mapa não encontrado!");
        return;
    }
    const loadingMessage = mapDiv.querySelector('p');
    if (loadingMessage) { loadingMessage.remove(); }

    try {
        console.log("Tentando criar new google.maps.Map...");
        map = new google.maps.Map(mapDiv, { center: coords, zoom: zoomLevel, mapId: "DEMO_MAP_ID" });
        console.log("...Mapa criado OK. Tentando criar PlacesService...");

        placesService = new google.maps.places.PlacesService(map);
        console.log("...PlacesService criado OK. Tentando criar DirectionsService...");

        directionsService = new google.maps.DirectionsService();
        console.log("...DirectionsService criado OK. Tentando criar DirectionsRenderer...");

        directionsRenderer = new google.maps.DirectionsRenderer({ map: map, suppressMarkers: false });
        console.log("...DirectionsRenderer criado OK.");

        console.log("Mapa e serviços do Google Maps prontos.");
        setupEventListeners(); // Chama a configuração dos listeners

    } catch (error) {
        console.error("!!! ERRO DENTRO DO TRY de initializeMapWithCoords:", error);
        if (mapDiv) { mapDiv.innerHTML = `<p style="color: red; padding: 20px; font-weight: bold;">ERRO ao inicializar mapa/serviços: ${error.message}. Verifique console e APIs habilitadas.</p>`; }
    }
}

/**
 * Configura todos os listeners de eventos para os botões e inputs.
 */
function setupEventListeners() {
    console.log("Configurando listeners de eventos...");

    appContainer = document.getElementById('app-container');
    const backButton = document.getElementById('back-button');
    const searchInput = document.getElementById('search-input');
    const addLocationBtn = document.getElementById('add-location-btn');
    const selectedLocationsList = document.getElementById('selected-locations-list');
    const categoryButtons = document.querySelectorAll('.category-btn');
    const routeFoundBtn = document.getElementById('route-found-btn');

    // Verifica elementos essenciais (COM LOG DETALHADO)
    let missingElement = null;
    if (!appContainer) missingElement = '#app-container';
    else if (!searchInput) missingElement = '#search-input';
    else if (!addLocationBtn) missingElement = '#add-location-btn';
    else if (!selectedLocationsList) missingElement = '#selected-locations-list';
    else if (!categoryButtons || categoryButtons.length === 0) missingElement = '.category-btn';
    else if (!routeFoundBtn) missingElement = '#route-found-btn';

    if (missingElement) {
        console.error(`ERRO FATAL em setupEventListeners: Elemento essencial "${missingElement}" não encontrado no HTML! A aplicação pode não funcionar corretamente.`);
        // Considerar parar aqui ou mostrar um erro mais visível
        // alert(`Erro: Elemento ${missingElement} não encontrado.`);
        return; // Para a execução da configuração dos listeners
    }
    if (!backButton) { // Verifica botão voltar separadamente
        console.warn("AVISO: Botão #back-button não encontrado no HTML. Funcionalidade 'Voltar' indisponível.");
    }

    // --- Configuração do Autocomplete ---
    setTimeout(() => { // Leve atraso para garantir API pronta
        if (map && google.maps.places) {
            try {
                const autocomplete = new google.maps.places.Autocomplete(searchInput, {
                    componentRestrictions: { country: "br" },
                    fields: ["name", "geometry.location", "place_id", "formatted_address"],
                    types: ['geocode', 'establishment']
                });
                // autocomplete.bindTo('bounds', map); // Opcional: restringir à área visível

                autocomplete.addListener('place_changed', () => {
                    const place = autocomplete.getPlace();
                    selectedPlaceData = (place && place.geometry && place.geometry.location) ? place : null;
                    console.log('Autocomplete: place_changed. Local selecionado:', selectedPlaceData ? selectedPlaceData.name : 'Inválido');
                });
                searchInput.addEventListener('input', () => { if (!searchInput.value) { selectedPlaceData = null; } });
                console.log("Autocomplete inicializado.");
            } catch (e) { console.error("ERRO ao inicializar Autocomplete:", e); /* ... desabilitar inputs ... */ }
        } else { console.error("Autocomplete não pôde ser inicializado (mapa/places não prontos)."); /* ... desabilitar inputs ... */ }
    }, 500);

    // --- Adicionar Local Manualmente (Listener Botão e Enter) ---
    function addSelectedPlaceToList() {
        if (!selectedPlaceData) { alert("Digite um local e selecione uma sugestão válida."); searchInput.focus(); return; }
        const { name, geometry, place_id } = selectedPlaceData;
        if (markers.some(item => item.placeId === place_id)) { alert(`"${name}" já está na lista.`); /* ... limpar ... */ return; }
        console.log(`Adicionando manual: "${name}"`);
        const marker = new google.maps.Marker({ position: geometry.location, map: map, title: name });
        markers.push({ name: name, position: geometry.location, placeId: place_id, marker: marker });
        // Cria LI na lista visual
        const li = document.createElement('li'); li.dataset.placeId = place_id;
        const nameSpan = document.createElement('span'); nameSpan.textContent = name;
        const removeBtn = document.createElement('button'); removeBtn.textContent = 'X'; removeBtn.classList.add('remove-btn'); removeBtn.title = "Remover";
        li.appendChild(nameSpan); li.appendChild(removeBtn);
        selectedLocationsList.appendChild(li);
        // Limpa
        searchInput.value = ""; selectedPlaceData = null; searchInput.focus();
        // Ajusta zoom (opcional)
        // ... (código de ajuste de bounds) ...
    }
    if (addLocationBtn) { addLocationBtn.addEventListener('click', addSelectedPlaceToList); }
    if (searchInput) { searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); addSelectedPlaceToList(); } }); }


    // --- Limpar Marcadores Encontrados ---
    // (A função está definida fora, mas é usada pelos listeners abaixo)


    // --- Listener Botões de Categoria ---
    categoryButtons.forEach(button => {
        button.addEventListener('click', function() {
            const categoryType = this.dataset.category;
            console.log(`>>> CATEGORIA CLICADA: "${categoryType}" <<<`);

             // Verifica se serviços estão prontos ANTES de prosseguir
             if (!map || !placesService || !directionsService || !directionsRenderer) {
                 alert("ERRO: Mapa ou um dos serviços Google (Places, Directions) não está pronto. Recarregue a página.");
                 console.error("Busca de categoria: Serviços Google indisponíveis.", { map, placesService, directionsService, directionsRenderer });
                 return; // Para a execução
             }

            // LOG ANTES DE LIMPAR
            console.log(`--- ANTES de limpar: foundMarkers tem ${foundMarkers.length} itens.`);

            // Limpeza dos marcadores/rota anteriores
            clearFoundMarkers(); // Chama a função que agora usa foundMarkers = [];
            console.log(`--- Após chamar clearFoundMarkers(): foundMarkers tem ${foundMarkers.length} itens.`); // Deve ser 0

            // Inicia a busca
            let searchLocation = currentUserLocation;
            let searchRadius = 5000; // 5km
            let request;
            console.log(`Iniciando busca para "${categoryType}"...`);

            if (searchLocation) {
                request = { location: searchLocation, radius: searchRadius, keyword: categoryType };
                placesService.nearbySearch(request, handleSearchResults); // Usa nearbySearch
            } else {
                console.warn("Localização do usuário não disponível, buscando na área visível do mapa.");
                if (!map.getBounds()) { alert("Não foi possível definir a área de busca no mapa."); return; }
                request = { bounds: map.getBounds(), query: categoryType }; // Usa query com textSearch
                placesService.textSearch(request, handleSearchResults); // Usa textSearch
            }
        });
    });

    /**
     * Função Callback para processar resultados da busca por categoria.
     * (Definida aqui para ter acesso a foundMarkers, map, routeFoundBtn etc.)
     */
    function handleSearchResults(results, status) {
        if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
            console.log(`Busca OK: ${results.length} locais encontrados.`);
            let bounds = new google.maps.LatLngBounds();
            let validMarkersCount = 0;
            // Limpa foundMarkers ANTES de adicionar novos (garantia extra)
            foundMarkers = [];

            results.forEach(place => {
                if (place.geometry && place.geometry.location) {
                    const foundMarker = new google.maps.Marker({ map: map, position: place.geometry.location, title: place.name });
                    foundMarker.placeData = place; // Guarda dados originais
                    foundMarkers.push(foundMarker); // Adiciona ao array global
                    bounds.extend(place.geometry.location);
                    validMarkersCount++;
                } else { console.warn("Local sem geometria:", place.name); }
            });

            if (validMarkersCount > 0) {
                console.log(`${validMarkersCount} marcadores válidos criados. Itens em foundMarkers: ${foundMarkers.length}`);
                if (currentUserLocation) { bounds.extend(currentUserLocation); }
                map.fitBounds(bounds);
                if (map.getZoom() > 16) map.setZoom(16);
                if (routeFoundBtn) { routeFoundBtn.disabled = false; console.log("Botão 'Traçar Rota' HABILITADO."); }
            } else {
                console.warn("Busca OK, mas nenhum marcador válido."); alert("Nenhum local com localização encontrado.");
                if (routeFoundBtn) routeFoundBtn.disabled = true;
            }
        } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
            console.log("Busca ZERO_RESULTS."); alert("Nenhum local encontrado para esta categoria na área.");
            if (routeFoundBtn) routeFoundBtn.disabled = true;
        } else {
            console.error("Erro na busca por locais: " + status); alert("Erro ao buscar locais: " + status);
            if (routeFoundBtn) routeFoundBtn.disabled = true;
        }
    }

    // --- Listener Botão "Traçar Rota" (Busca por Categoria) ---
    if (routeFoundBtn) {
        routeFoundBtn.addEventListener('click', function() {
            // REMOVIDO ALERT DE DEBUG: alert(`Tentando traçar rota com ${foundMarkers.length} locais encontrados.`);
            console.log(`>>> [Traçar Rota Clicado] Número de foundMarkers: ${foundMarkers.length}`);

            // Verifica serviços ANTES de prosseguir
            if (!map || !placesService || !directionsService || !directionsRenderer) {
                alert("ERRO: Mapa ou um dos serviços Google (Places, Directions) não está pronto ao tentar traçar rota. Recarregue.");
                console.error("Traçar rota: Serviços Google indisponíveis.", { map, placesService, directionsService, directionsRenderer });
                this.disabled = foundMarkers.length === 0; this.textContent = "Traçar Rota"; return;
            }
            // Verifica se há marcadores
            if (foundMarkers.length === 0) { alert("Nenhum local encontrado para incluir na rota."); return; }

            console.log("Botão 'Traçar Rota' clicado. Solicitando localização...");
            this.disabled = true; this.textContent = "Localizando...";

            // Solicita localização atual
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => { // SUCESSO ao obter localização
                        this.textContent = "Calculando...";
                        const userPos = { lat: position.coords.latitude, lng: position.coords.longitude };
                        currentUserLocation = userPos; // Atualiza global
                        console.log("Localização obtida para traçar rota:", userPos);

                        // Chama função para atualizar/criar marcador do usuário
                        console.log(">>> Traçar Rota: CHAMANDO updateUserMarkerAndAccuracy com a posição obtida.");
                        updateUserMarkerAndAccuracy(position);

                        // Prossegue com cálculo da rota
                        console.log("Calculando rota da localização atual para locais encontrados...");
                        if (directionsRenderer) directionsRenderer.setDirections({ routes: [] });

                        // LIMITA WAYPOINTS
                        const MAX_ALLOWED_WAYPOINTS = 10;
                        const markersForRoute = foundMarkers.slice(0, MAX_ALLOWED_WAYPOINTS + 1);
                        console.log(`Limitando a rota para ${markersForRoute.length} locais (máx ${MAX_ALLOWED_WAYPOINTS + 1}).`);
                        const waypointsLimited = markersForRoute.map(m => ({ location: m.getPosition(), stopover: true }));

                        let originPoint = userPos;
                        let destinationPoint;
                        let waypointsForRequest = [];

                        if (waypointsLimited.length === 0) { /* ... erro ... */ }
                        else if (waypointsLimited.length === 1) { destinationPoint = waypointsLimited[0].location; }
                        else { destinationPoint = waypointsLimited[waypointsLimited.length - 1].location; waypointsForRequest = waypointsLimited.slice(0, -1); }

                        const request = {
                            origin: originPoint, destination: destinationPoint, waypoints: waypointsForRequest,
                            optimizeWaypoints: true, travelMode: google.maps.TravelMode.DRIVING
                        };

                        console.log("Enviando requisição de rota:", request);
                        directionsService.route(request, (result, status) => { // Callback da rota
                            if (status === google.maps.DirectionsStatus.OK) {
                                console.log("Rota calculada com sucesso.");
                                directionsRenderer.setDirections(result);
                                currentRouteResult = result; currentRouteRequest = request; isRecalculating = false;

                                // ENTRAR NO MODO MAPA
                                if (appContainer) {
                                    appContainer.classList.add('map-only-mode');
                                    console.log("Entrando no Modo Mapa.");
                                    setTimeout(() => { // Atraso para transição CSS
                                        if (map) {
                                            google.maps.event.trigger(map, 'resize');
                                            if (result.routes && result.routes[0] && result.routes[0].bounds) { map.fitBounds(result.routes[0].bounds); }
                                            console.log("Mapa redimensionado para Modo Mapa.");
                                        }
                                    }, 350);
                                }
                                this.textContent = "Rota Traçada"; // Texto final botão
                            } else { // ERRO NA ROTA
                                console.error('Erro ao calcular a rota: ' + status); alert('Erro ao calcular a rota: ' + status);
                                currentRouteResult = null; currentRouteRequest = null;
                                this.disabled = foundMarkers.length === 0; this.textContent = "Traçar Rota"; // Reabilita botão
                            }
                        }); // Fim callback rota

                    }, (error) => { // ERRO ao obter localização
                        console.error("Erro ao obter localização no clique:", error);
                        handleLocationError(error, false);
                        alert("Não foi possível obter sua localização. Verifique as permissões.");
                        this.disabled = foundMarkers.length === 0; this.textContent = "Traçar Rota"; // Reabilita botão
                    },
                    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 } // Opções geo
                ); // Fim getCurrentPosition
            } else { // Navegador não suporta geo
                alert("Geolocalização não é suportada."); this.disabled = foundMarkers.length === 0; this.textContent = "Traçar Rota";
            }
        }); // Fim listener routeFoundBtn
    } // Fim if(routeFoundBtn)


    // --- Listener Remover Item da Lista Manual ---
    if (selectedLocationsList) {
        selectedLocationsList.addEventListener('click', function(event) {
            if (event.target.classList.contains('remove-btn')) {
                const listItem = event.target.closest('li'); if (!listItem) return;
                const placeIdToRemove = listItem.dataset.placeId; if (!placeIdToRemove) return;
                console.log(`Removendo manual placeId: ${placeIdToRemove}`);
                const indexToRemove = markers.findIndex(item => item.placeId === placeIdToRemove);
                if (indexToRemove !== -1) {
                    markers[indexToRemove].marker.setMap(null);
                    const removedItem = markers.splice(indexToRemove, 1)[0];
                    console.log(`Removido da lista manual: "${removedItem.name}"`);
                    listItem.remove();
                    // Ajustar zoom? Limpar rota manual se estava ativa?
                } else { console.warn("Item não encontrado no array 'markers' para remover."); }
            }
        });
    } // Fim if(selectedLocationsList)


    // --- Listener Botão Voltar (Modo Mapa) ---
    if (backButton && appContainer) {
        backButton.addEventListener('click', () => {
            console.log("Botão Voltar clicado.");
            appContainer.classList.remove('map-only-mode');
            console.log("Saindo do Modo Mapa.");
            if (directionsRenderer) { directionsRenderer.setDirections({ routes: [] }); console.log("Rota limpa do display."); }
            // Decidir se limpa foundMarkers aqui: // clearFoundMarkers();
            currentRouteResult = null; currentRouteRequest = null; // Limpa dados da rota ativa

            setTimeout(() => { // Atraso para transição CSS
                if (map) {
                    google.maps.event.trigger(map, 'resize');
                    console.log("Mapa redimensionado para layout normal.");
                    // Ajustar zoom para pontos existentes
                    const bounds = new google.maps.LatLngBounds(); let hasPoints = false;
                    if (userLocationMarker) { bounds.extend(userLocationMarker.getPosition()); hasPoints = true; }
                    markers.forEach(m => { bounds.extend(m.marker.getPosition()); hasPoints = true; });
                    // Incluir foundMarkers se não foram limpos?
                    if (hasPoints) { map.fitBounds(bounds); if (map.getZoom() > 17) map.setZoom(17); }
                }
            }, 350);

            if (routeFoundBtn) { routeFoundBtn.disabled = foundMarkers.length === 0; routeFoundBtn.textContent = "Traçar Rota"; }
        });
    } // Fim if(backButton && appContainer)

    console.log("Configuração dos listeners concluída.");

} // --- FIM DA FUNÇÃO setupEventListeners ---


/**
 * Limpa marcadores encontrados e rota associada.
 */
// Bloco NOVO para o conteúdo da função clearFoundMarkers
function clearFoundMarkers() {
    console.log(`>>> clearFoundMarkers: Iniciando limpeza. ${foundMarkers ? `Array existe com ${foundMarkers.length} itens.` : 'Array é undefined/null.'}`);

    // Verifica se 'foundMarkers' é realmente um array antes de tentar acessar 'length' ou 'forEach'
    if (foundMarkers && Array.isArray(foundMarkers)) {
        if (foundMarkers.length > 0) {
             console.log(`>>> clearFoundMarkers: Removendo ${foundMarkers.length} marcadores do mapa...`);
             try { // Adiciona try-catch para a remoção
                  foundMarkers.forEach((marker, index) => {
                       // Verifica se o item é um marcador válido antes de chamar setMap
                       if (marker && typeof marker.setMap === 'function') {
                            marker.setMap(null);
                       } else {
                            console.warn(`>>> clearFoundMarkers: Item no índice ${index} não é um marcador válido ou não tem setMap.`);
                       }
                  });
                  console.log(`>>> clearFoundMarkers: Marcadores removidos do mapa.`);
             } catch (e) {
                  console.error(`>>> clearFoundMarkers: Erro durante forEach/setMap(null):`, e);
             }
             // Tenta zerar o array usando length = 0 APÓS remover do mapa
             try {
                  foundMarkers.length = 0;
                  console.log(`>>> clearFoundMarkers: Array 'foundMarkers' zerado via length (length atual: ${foundMarkers.length}).`);
             } catch (e) {
                  console.error(`>>> clearFoundMarkers: Erro ao tentar zerar array com length = 0:`, e);
                  console.log(`>>> clearFoundMarkers: Tentando resetar com 'foundMarkers = [];' como fallback.`);
                  foundMarkers = []; // Fallback se length=0 falhar
             }
        } else {
             console.log(">>> clearFoundMarkers: Array 'foundMarkers' já estava vazio (length 0).");
        }
    } else {
        console.warn(">>> clearFoundMarkers: 'foundMarkers' não é um array válido. Resetando para [].");
        foundMarkers = []; // Garante que seja um array vazio se era inválido
    }

    // Limpa outros estados relacionados
    currentRouteResult = null;
    currentRouteRequest = null;
    if (routeFoundBtn) { routeFoundBtn.disabled = true; }
    if (directionsRenderer) { directionsRenderer.setDirections({ routes: [] }); }
    console.log(">>> clearFoundMarkers: Limpeza de rota/botão concluída. Estado final de foundMarkers:", foundMarkers); // Log final
}


// Chamada inicial (via callback da API do Google Maps na tag <script>)
console.log("Aguardando API do Google Maps chamar initMap...");