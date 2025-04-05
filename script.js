// ========================================================================
// Rota Fácil - script.js
// ATUALIZADO para incluir Recálculo Automático de Rota por Desvio
// ========================================================================

// Variáveis globais
let map;
let placesService;
let directionsService;
let directionsRenderer;
const markers = []; // Marcadores adicionados manualmente
let foundMarkers = []; // Marcadores encontrados pela busca/tour
let currentUserLocation = null;
let userLocationMarker = null;
let userLocationAccuracyCircle = null;
let watchId = null;
// Variáveis para Recálculo de Rota
let currentRouteResult = null;     // Guarda o resultado da rota atual
let currentRouteRequest = null;    // Guarda os parâmetros da requisição da rota atual
let isRecalculating = false;       // Flag para evitar recálculos múltiplos
const ROUTE_DEVIATION_TOLERANCE = 50; // Distância em metros para considerar "fora da rota" (ajuste se necessário)
let selectedPlaceData = null;

/**
 * Cria ou atualiza o marcador e o círculo de precisão da localização do usuário.
 * Também aciona a verificação de desvio de rota.
 * @param {GeolocationPosition} position O objeto de posição da API de Geolocalização.
 */
/**
 * Cria ou atualiza o marcador (agora uma seta) e o círculo de precisão da localização do usuário.
 * Também aciona a verificação de desvio de rota.
 * @param {GeolocationPosition} position O objeto de posição da API de Geolocalização.
 */
function updateUserMarkerAndAccuracy(position) { // <--- COMEÇA AQUI
    const pos = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
    };
    const accuracy = position.coords.accuracy; // Precisão em metros
    const heading = position.coords.heading;  // Tenta obter o heading

    if (!map) {
        console.error("Mapa não inicializado ao tentar atualizar marcador do usuário.");
        return;
    }

    // --- Atualiza Círculo de Precisão ---
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

    // --- Cria ou Atualiza MARCADOR DE SETA ---
    let iconConfig = {
        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, // Define a forma da seta
        fillColor: '#1a73e8',      // Cor da seta
        fillOpacity: 1,
        strokeColor: '#ffffff',      // Cor da borda
        strokeWeight: 2,
        scale: 6,                   // Tamanho da seta
        anchor: new google.maps.Point(0, 2), // Ponto de ancoragem ajustado para centralizar
        rotation: 0                 // Rotação inicial
    };

    // Aplica rotação se heading for válido
    if (heading !== null && !isNaN(heading) && typeof heading === 'number') {
        iconConfig.rotation = heading;
    } else {
        // console.log("Heading não disponível ou inválido."); // Log opcional
    }

    // Atualiza ou cria o marcador
    if (userLocationMarker) {
        userLocationMarker.setPosition(pos);
        userLocationMarker.setIcon(iconConfig); // Atualiza o ícone (com nova rotação/posição)
    } else {
        userLocationMarker = new google.maps.Marker({
            position: pos,
            map: map,
            title: 'Sua localização atual',
            icon: iconConfig, // Usa o ícone de seta na criação
            zIndex: 2
        });
        console.log("Marcador de seta da localização do usuário criado.");
        // Só centraliza e ajusta zoom na primeira vez
        map.setCenter(pos);
        map.setZoom(16);
    }

    // --- Atualiza Variável Global ---
    currentUserLocation = pos;

    // --- Lógica de Verificação de Desvio de Rota (permanece igual) ---
    if (currentRouteResult && !isRecalculating && currentUserLocation) {
        let routePath = [];
        currentRouteResult.routes[0].legs.forEach(leg => { leg.steps.forEach(step => { routePath = routePath.concat(step.path); }); });
        const routePolyline = new google.maps.Polyline({ path: routePath });
        const isOnRoute = google.maps.geometry.poly.isLocationOnEdge(currentUserLocation, routePolyline, ROUTE_DEVIATION_TOLERANCE);
        if (!isOnRoute) {
            console.warn(`Usuário fora da rota (${ROUTE_DEVIATION_TOLERANCE}m). Recalculando...`);
            isRecalculating = true;
            const newRequest = { origin: currentUserLocation, destination: currentRouteRequest.destination, waypoints: currentRouteRequest.waypoints, optimizeWaypoints: currentRouteRequest.optimizeWaypoints, travelMode: currentRouteRequest.travelMode };
            console.log("Nova requisição:", newRequest);
            directionsService.route(newRequest, (newResult, status) => {
                if (status === google.maps.DirectionsStatus.OK) {
                    console.log("Rota recalculada OK!");
                    directionsRenderer.setDirections(newResult);
                    currentRouteResult = newResult;
                    currentRouteRequest = newRequest;
                } else { console.error("Erro recalcular rota:", status); }
                setTimeout(() => { isRecalculating = false; console.log("Flag recálculo liberada."); }, 5000);
            });
        }
    }
    // --- FIM Lógica de Verificação de Desvio ---

} // <-- Fim da função updateUserMarkerAndAccuracy


/**
 * Lida com erros da API de Geolocalização (tanto getCurrentPosition quanto watchPosition).
 * @param {GeolocationPositionError} error O objeto de erro.
 * @param {boolean} isWatching Indica se o erro veio do watchPosition (true) ou getCurrentPosition (false).
 */
function handleLocationError(error, isWatching) {
    let prefix = isWatching ? 'Erro ao monitorar localização' : 'Erro ao obter localização inicial';
    let message = `${prefix}: `;
    switch(error.code) {
       case error.PERMISSION_DENIED: message += "Permissão de localização negada pelo usuário."; break;
       case error.POSITION_UNAVAILABLE: message += "Informação de localização indisponível."; break;
       case error.TIMEOUT: message += "Tempo limite esgotado ao tentar obter localização."; break;
       case error.UNKNOWN_ERROR: message += "Erro desconhecido."; break;
       default: message += `Código de erro ${error.code}.`; break;
    }
    console.warn(message, error);
    // alert(message); // Pode ser irritante, melhor usar console

    // Se o erro for de permissão durante o monitoramento, removemos o marcador/círculo
    if (isWatching && error.code === error.PERMISSION_DENIED) {
       if (userLocationMarker) {
           userLocationMarker.setMap(null);
           userLocationMarker = null;
       }
       if (userLocationAccuracyCircle) {
           userLocationAccuracyCircle.setMap(null);
           userLocationAccuracyCircle = null;
       }
       // Parar o watch se a permissão for negada durante o monitoramento
       if (watchId !== null) {
          navigator.geolocation.clearWatch(watchId);
          watchId = null;
          console.log("Monitoramento parado devido à negação de permissão.");
       }
    }
}

// Função chamada pelo Google Maps API (MODIFICADA para Geolocalização Inicial e Watch)
function initMap() {
    console.log("Google Maps API carregada, função initMap executada.");

    // Verifica se geolocalização é suportada
    if (navigator.geolocation) {
        console.log("Navegador suporta Geolocalização. Tentando obter localização inicial...");

        // 1. Tenta obter a localização INICIAL uma vez
        navigator.geolocation.getCurrentPosition(
            (position) => { // SUCESSO ao obter posição inicial
                console.log("Localização inicial obtida:", position.coords);
                const userCoords = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                };
                // Inicializa o mapa COM a localização do usuário
                initializeMapWithCoords(userCoords, 15); // Zoom um pouco maior

                // IMPORTANTE: Cria o marcador inicial AGORA, ANTES de iniciar o watch
                updateUserMarkerAndAccuracy(position);

                // 2. Inicia o MONITORAMENTO CONTÍNUO (watchPosition)
                if (watchId === null) {
                    console.log("Iniciando monitoramento contínuo da localização (watchPosition)...");
                    watchId = navigator.geolocation.watchPosition(
                        (newPosition) => { // SUCESSO ao detectar MUDANÇA de posição
                            // console.log("Nova localização detectada (watchPosition):", newPosition.coords); // Log menos verboso
                            updateUserMarkerAndAccuracy(newPosition); // Atualiza marcador/círculo e verifica desvio
                        },
                        (error) => { // ERRO durante o monitoramento contínuo
                            handleLocationError(error, true); // Chama nosso handler de erro (isWatching = true)
                        },
                        { // Opções para watchPosition
                            enableHighAccuracy: true,
                            maximumAge: 10000, // Reutiliza posição de até 10s atrás (ajuste se necessário)
                            // maximumAge: 0, // Use 0 para forçar nova leitura (gasta mais bateria)
                            timeout: 20000
                        }
                    );
                    console.log("Monitoramento iniciado com watchId:", watchId);
                }
            },
            (error) => { // ERRO ao obter posição inicial
                currentUserLocation = null; // Garante que está nulo
                handleLocationError(error, false); // Chama nosso handler de erro (isWatching = false)

                // Falha ao obter localização inicial, usa SP como padrão
                console.warn("Não foi possível obter localização inicial. Usando São Paulo.");
                const defaultCoords = { lat: -23.5505, lng: -46.6333 };
                initializeMapWithCoords(defaultCoords, 13); // Inicializa mapa com SP
            }
        ); // Fim de getCurrentPosition

    } else {
        // Navegador NÃO suporta geolocalização
        currentUserLocation = null;
        console.warn("Navegador não suporta Geolocalização. Usando São Paulo.");
        alert("Seu navegador não suporta Geolocalização.");
        const defaultCoords = { lat: -23.5505, lng: -46.6333 };
        initializeMapWithCoords(defaultCoords, 13); // Inicializa mapa com SP
    }
}

// Função auxiliar para inicializar o mapa com coordenadas específicas
function initializeMapWithCoords(coords, zoomLevel) {
    const mapDiv = document.getElementById('map-container');
    if (!mapDiv) {
        console.error("ERRO CRÍTICO: Div 'map-container' não encontrada.");
        mapDiv.innerHTML = "<p>Erro: Container do mapa não encontrado!</p>";
        return;
    }

     // Remove mensagem "Carregando mapa..."
     const loadingMessage = mapDiv.querySelector('p');
     if (loadingMessage) {
         loadingMessage.remove();
     }

    try {
        map = new google.maps.Map(mapDiv, {
            center: coords,
            zoom: zoomLevel,
            mapId: "DEMO_MAP_ID" // Use sua Map ID se tiver
        });

        placesService = new google.maps.places.PlacesService(map);
        directionsService = new google.maps.DirectionsService();
        directionsRenderer = new google.maps.DirectionsRenderer();
        directionsRenderer.setMap(map);

        console.log("Mapa e serviços do Google Maps prontos.");

        // Chama a configuração dos listeners APÓS o mapa estar pronto
        setupEventListeners();

    } catch (error) {
        console.error("ERRO ao inicializar o Google Maps:", error);
        mapDiv.innerHTML = `<p>Erro ao carregar o mapa: ${error.message}. Verifique a chave da API e a conexão.</p>`;
    }
}

// --- Configuração dos Listeners (Chamada após initMap) ---
// --- Configuração dos Listeners (Chamada após initMap) ---
function setupEventListeners() {
    console.log("Configurando listeners de eventos...");

    // Referências aos elementos HTML
    const searchInput = document.getElementById('search-input');
    const addLocationBtn = document.getElementById('add-location-btn');
    const selectedLocationsList = document.getElementById('selected-locations-list');
    const calculateRouteBtn = document.getElementById('calculate-route-btn');
    const tourBarsNearbyBtn = document.getElementById('tour-bars-nearby-btn');
    const categoryButtons = document.querySelectorAll('.category-btn');
    const routeFoundBtn = document.getElementById('route-found-btn');

    // Verifica elementos essenciais
    if (!searchInput || !addLocationBtn || !selectedLocationsList || !calculateRouteBtn || !tourBarsNearbyBtn || !categoryButtons || !routeFoundBtn) {
        console.error('ERRO: Um ou mais elementos essenciais da interface não foram encontrados!');
        return;
    }

    // --- INÍCIO: Configuração do Autocomplete (com setTimeout) ---
    // Atraso para garantir que a API esteja totalmente pronta
    setTimeout(() => {
        if (map && google.maps.places) {
            console.log("Tentando inicializar Autocomplete dentro do setTimeout..."); // LOG NOVO
            try { // Adiciona try-catch para segurança
                const autocomplete = new google.maps.places.Autocomplete(searchInput, {
                    componentRestrictions: { country: "br" },
                    fields: ["name", "geometry.location", "place_id", "formatted_address"],
                    types: ['geocode', 'establishment']
                });

                // Listener para QUANDO um local é selecionado na lista
                autocomplete.addListener('place_changed', () => {
                    console.log('>>> Evento place_changed DISPARADO!'); // LOG 1
                    const place = autocomplete.getPlace();
                    if (place && place.geometry && place.geometry.location) {
                        // Usamos a variável global aqui
                        selectedPlaceData = place; // GUARDA os dados na var global
                        console.log('>>> place_changed: Local VÁLIDO selecionado e ARMAZENADO em selectedPlaceData:', selectedPlaceData); // LOG 2
                    } else {
                        selectedPlaceData = null; // Limpa se inválido
                        console.log('>>> place_changed: Seleção inválida ou sem geometria. selectedPlaceData LIMPO.'); // LOG 3
                    }
                });

                // Listener para quando o usuário DIGITA no input (SIMPLIFICADO)
                searchInput.addEventListener('input', () => {
                    // Apenas limpa selectedPlaceData se o campo ficar completamente vazio
                    if (!searchInput.value) {
                         console.log('>>> Evento input: Campo VAZIO, limpando selectedPlaceData.'); // LOG 4
                         selectedPlaceData = null;
                    }
                });
                console.log("Autocomplete inicializado com sucesso dentro do setTimeout."); // LOG NOVO

            } catch (e) {
                 console.error("ERRO ao criar ou configurar Autocomplete dentro do setTimeout:", e); // LOG NOVO
                 searchInput.disabled = true; // Desabilita se falhar
                 addLocationBtn.disabled = true;
            }

        } else {
            console.error("Autocomplete não pôde ser inicializado (mapa ou lib places não prontos no setTimeout).");
            searchInput.disabled = true;
            addLocationBtn.disabled = true;
        }
    }, 500); // Atraso de 500ms (meio segundo)
    // --- FIM: Configuração do Autocomplete (com setTimeout) ---


    // --- INÍCIO: Função para Adicionar Local à Lista e Mapa ---
    // Definida aqui dentro para ter acesso fácil a selectedLocationsList, searchInput etc.
    // E usa a variável global selectedPlaceData
    function addSelectedPlaceToList() {
        console.log('>>> addSelectedPlaceToList: Função CHAMADA. Verificando selectedPlaceData...'); // LOG 5
        console.log('>>> addSelectedPlaceToList: Valor ATUAL de selectedPlaceData:', selectedPlaceData); // LOG 6

        if (!selectedPlaceData || !selectedPlaceData.geometry || !selectedPlaceData.geometry.location) {
            alert("Por favor, digite um endereço ou nome de local e SELECIONE uma das sugestões válidas da lista antes de adicionar.");
            console.warn(">>> addSelectedPlaceToList: FALHA na validação. selectedPlaceData está nulo ou inválido."); // LOG 7
            searchInput.focus();
            return;
        }

        // Se chegou aqui, 'selectedPlaceData' é válido
        const placeName = selectedPlaceData.name;
        const placePosition = selectedPlaceData.geometry.location;
        const placeId = selectedPlaceData.place_id;

        if (markers.some(item => item.placeId === placeId)) {
            alert(`"${placeName}" já está na lista.`);
            searchInput.value = "";
            selectedPlaceData = null;
            searchInput.focus();
            return;
        }

        console.log(`>>> addSelectedPlaceToList: Adicionando "${placeName}" à rota manual.`); // LOG 8

        // 1. Criar marcador
        const marker = new google.maps.Marker({ position: placePosition, map: map, title: placeName });
        // 2. Guardar dados (usa array global 'markers')
        markers.push({ name: placeName, position: placePosition, placeId: placeId, marker: marker });
        // 3. Adicionar à lista visual
        const li = document.createElement('li');
        li.dataset.placeId = placeId;
        const nameSpan = document.createElement('span');
        nameSpan.textContent = placeName;
        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'Remover';
        removeBtn.classList.add('remove-btn');
        li.appendChild(nameSpan);
        li.appendChild(removeBtn);
        selectedLocationsList.appendChild(li);
        // 4. Limpar input e seleção
        searchInput.value = "";
        selectedPlaceData = null; // Limpa a variável global após usar
        searchInput.focus();
    }
    // --- FIM: Função para Adicionar Local ---


    // Garante estado inicial do botão de rota de categoria
    routeFoundBtn.disabled = true;

    // --- FUNÇÕES AUXILIARES INTERNAS ---
    function clearFoundMarkers() { /* ... (código igual anterior) ... */
        console.log(`Limpando ${foundMarkers.length} marcadores encontrados.`);
        foundMarkers.forEach(marker => marker.setMap(null));
        foundMarkers.length = 0;
        currentRouteResult = null;
        currentRouteRequest = null;
        if (routeFoundBtn) {
             routeFoundBtn.disabled = true;
             console.log("Marcadores limpos, botão 'Traçar Rota' desabilitado, dados da rota limpos.");
        }
    }

    // --- LISTENERS DE EVENTOS (Restantes) ---

    // Listener para TODOS os Botões de Categoria
    categoryButtons.forEach(button => { /* ... (código igual anterior) ... */
        button.addEventListener('click', function() {
            const categoryType = this.dataset.category; console.log(`Botão da categoria "${categoryType}" clicado.`);
            if (!map || !placesService) { alert("Mapa/Serviços não prontos."); console.error("Busca antes do mapa/placesService."); return; }
            console.log("Nova busca, limpando rota anterior."); directionsRenderer.setDirections({ routes: [] }); currentRouteResult = null; currentRouteRequest = null; clearFoundMarkers();
            console.log(`Procurando por "${categoryType}"...`); const request = { bounds: map.getBounds(), query: categoryType };
            placesService.textSearch(request, function(results, status) {
                if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
                    console.log(`Busca OK: ${results.length} locais (${categoryType}).`);
                    results.forEach(place => { if (place.geometry && place.geometry.location) { const foundMarker = new google.maps.Marker({ map: map, position: place.geometry.location, title: place.name }); foundMarkers.push(foundMarker); } else { console.warn("Local sem geometria:", place.name); } });
                    if (foundMarkers.length > 0) {
                        console.log(`${foundMarkers.length} marcadores válidos.`); const bounds = new google.maps.LatLngBounds(); foundMarkers.forEach(marker => bounds.extend(marker.getPosition())); map.fitBounds(bounds); if (map.getZoom() > 16) map.setZoom(16); routeFoundBtn.disabled = false; console.log("Botão 'Traçar Rota' HABILITADO."); 
                    } else { console.warn("Busca OK, nenhum marcador válido."); routeFoundBtn.disabled = true; console.log("Botão 'Traçar Rota' desabilitado."); alert(`Busca por ${categoryType} sem resultados com localização.`); }
                } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) { console.log(`Busca por ${categoryType}: Nenhum resultado.`); alert(`Nenhum local (${categoryType}) encontrado.`); routeFoundBtn.disabled = true;
                } else { console.error(`Erro busca (${categoryType}): ${status}`); alert(`Erro busca (${categoryType}): ${status}.`); routeFoundBtn.disabled = true; }
            });
        });
    });

    // Botão "Traçar Rota" (BUSCA)
    routeFoundBtn.addEventListener('click', function() { /* ... (código igual anterior) ... */
        if (!directionsService || !directionsRenderer) { alert("Serviço rotas não pronto."); console.error("DS/DR nulos."); return; }
        if (!currentUserLocation) { alert("Localização atual não disponível."); console.error("currentUserLocation nulo."); return; }
        if (foundMarkers.length === 0) { alert("Nenhum local encontrado."); console.warn("routeFoundBtn sem foundMarkers."); return; }
        console.log("Calculando rota (atual -> busca)..."); directionsRenderer.setDirections({ routes: [] }); const waypoints = foundMarkers.map(marker => ({ location: marker.getPosition(), stopover: true })); let originPoint = currentUserLocation; let destinationPoint; let waypointsForRequest = []; if (waypoints.length === 1) { destinationPoint = waypoints[0].location; } else { destinationPoint = waypoints.pop().location; waypointsForRequest = waypoints; } const request = { origin: originPoint, destination: destinationPoint, waypoints: waypointsForRequest, optimizeWaypoints: true, travelMode: google.maps.TravelMode.DRIVING };
        directionsService.route(request, (result, status) => {
            if (status === google.maps.DirectionsStatus.OK) { console.log("Rota busca OK:", result); directionsRenderer.setDirections(result); currentRouteResult = result; currentRouteRequest = request; isRecalculating = false; console.log("Rota busca armazenada.");
            } else { console.error('Erro rota busca: ' + status); alert('Erro rota busca: ' + status); currentRouteResult = null; currentRouteRequest = null; }
        });
    });

    // Botão ADICIONAR Local Manualmente
    addLocationBtn.addEventListener('click', addSelectedPlaceToList);

    // Adicionar com Enter no Input
    searchInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            console.log(">>> Enter pressionado no input. Chamando addSelectedPlaceToList..."); // LOG 9
            addSelectedPlaceToList(); // Chama a função diretamente
        }
    });

    // Botão CALCULAR Rota Manualmente
    calculateRouteBtn.addEventListener('click', function() { /* ... (código igual anterior) ... */
        if (markers.length < 2) { alert("Adicione pelo menos 2 locais."); return; } if (!directionsService || !directionsRenderer) { alert("Serviço rotas não pronto."); return; }
        console.log("Calculando rota manual..."); directionsRenderer.setDirections({ routes: [] }); currentRouteResult = null; currentRouteRequest = null; const waypoints = markers.slice(1, -1).map(item => ({ location: item.position, stopover: true })); const origin = markers[0].position; const destination = markers[markers.length - 1].position; const request = { origin: origin, destination: destination, waypoints: waypoints, optimizeWaypoints: true, travelMode: google.maps.TravelMode.DRIVING }; console.log("Req. rota manual:", request);
        directionsService.route(request, (result, status) => {
            if (status === google.maps.DirectionsStatus.OK) { console.log("Rota manual OK:", result); directionsRenderer.setDirections(result);
            } else { console.error('Erro rota manual: ' + status); alert('Erro rota manual: ' + status); }
        });
    });

    // Listener para Remover Item da Lista Manual
    selectedLocationsList.addEventListener('click', function(event) { /* ... (código igual anterior) ... */
        if (event.target.classList.contains('remove-btn')) {
            const listItem = event.target.closest('li'); if (!listItem) return; const placeIdToRemove = listItem.dataset.placeId; if (!placeIdToRemove) return; console.log(`Removendo placeId: ${placeIdToRemove}`); const indexToRemove = markers.findIndex(item => item.placeId === placeIdToRemove);
            if (indexToRemove !== -1) { markers[indexToRemove].marker.setMap(null); const removedItem = markers.splice(indexToRemove, 1)[0]; console.log(`Removido: "${removedItem.name}"`); listItem.remove();
            } else { console.warn("Item não encontrado para remover."); }
        }
    });

    // Botão "Iniciar Tour Próximo" (Placeholder)
    tourBarsNearbyBtn.addEventListener('click', function() { alert("Tour Próximo - Não implementado"); });

    // Remover item de exemplo (se existir)
    const exampleItem = selectedLocationsList.querySelector('li');
    if (exampleItem && exampleItem.textContent.includes('Exemplo:')) { exampleItem.remove(); }

    console.log("Configuração dos listeners concluída.");

} // --- Fim da função setupEventListeners ---ers ---

// ... (Resto do arquivo: handleLocationError, initMap, updateUserMarkerAndAccuracy, initializeMapWithCoords, etc. - verificar se essas funções existem no final)

// Chamada inicial (via callback da API do Google Maps)
console.log("Aguardando API do Google Maps chamar initMap...");