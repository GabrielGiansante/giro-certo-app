// ========================================================================
// Rota Fácil - script.js
// ATUALIZADO para incluir Modo Mapa e Botão Voltar
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

// --- NOVO: Referência ao container principal (para modo mapa) ---
// Será atribuída em setupEventListeners
let appContainer = null;


/**
 * Cria ou atualiza o marcador (agora uma seta) e o círculo de precisão da localização do usuário.
 * Também aciona a verificação de desvio de rota.
 * @param {GeolocationPosition} position O objeto de posição da API de Geolocalização.
 */
function updateUserMarkerAndAccuracy(position) {
    // ... (código desta função permanece exatamente o mesmo de antes) ...
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
        // Só centraliza e ajusta zoom na primeira vez que o marcador é criado
        // (Evita recentralizar a cada movimento se o usuário mexeu no mapa)
        // map.setCenter(pos);
        // map.setZoom(16);
    }

    // --- Atualiza Variável Global ---
    currentUserLocation = pos;

    // --- Lógica de Verificação de Desvio de Rota (permanece igual) ---
    if (currentRouteResult && !isRecalculating && currentUserLocation) {
        let routePath = [];
        currentRouteResult.routes[0].legs.forEach(leg => { leg.steps.forEach(step => { routePath = routePath.concat(step.path); }); });
        const routePolyline = new google.maps.Polyline({ path: routePath });

        // Verifica se a localização atual está na rota (ou próxima o suficiente)
        if (google.maps.geometry && google.maps.geometry.poly) { // Checa se a biblioteca geometry está carregada
             const isOnRoute = google.maps.geometry.poly.isLocationOnEdge(
                currentUserLocation,
                routePolyline,
                ROUTE_DEVIATION_TOLERANCE / 100000 // Tolerância precisa ser convertida para graus (aproximado)
                                                // Ajuste este fator se necessário, ou use uma biblioteca
                                                // mais robusta para distância ponto-polilinha em metros.
             );

            if (!isOnRoute) {
                console.warn(`Usuário fora da rota (${ROUTE_DEVIATION_TOLERANCE}m). Recalculando...`);
                isRecalculating = true;
                // Prepara a nova requisição de rota usando a localização atual como origem
                 const waypointsOriginal = currentRouteRequest.waypoints || []; // Pega waypoints originais
                 const newRequest = {
                     origin: currentUserLocation,
                     destination: currentRouteRequest.destination,
                     waypoints: waypointsOriginal, // Mantém os waypoints intermediários
                     optimizeWaypoints: currentRouteRequest.optimizeWaypoints,
                     travelMode: currentRouteRequest.travelMode
                 };

                console.log("Nova requisição para recálculo:", newRequest);
                directionsService.route(newRequest, (newResult, status) => {
                    if (status === google.maps.DirectionsStatus.OK) {
                        console.log("Rota recalculada com sucesso!");
                        directionsRenderer.setDirections(newResult);
                        currentRouteResult = newResult; // Atualiza a rota atual
                        currentRouteRequest = newRequest; // Atualiza a requisição atual
                    } else {
                        console.error("Erro ao recalcular rota:", status);
                        // Considerar o que fazer em caso de erro (manter rota antiga? limpar?)
                    }
                    // Libera a flag após um tempo para evitar recálculos excessivos
                    setTimeout(() => {
                         isRecalculating = false;
                         console.log("Flag de recálculo liberada.");
                    }, 5000); // Espera 5 segundos
                });
            }
        } else {
            console.warn("Biblioteca 'geometry' do Google Maps não carregada, verificação de desvio pulada.");
        }
    }
    // --- FIM Lógica de Verificação de Desvio ---
}


/**
 * Lida com erros da API de Geolocalização.
 * @param {GeolocationPositionError} error O objeto de erro.
 * @param {boolean} isWatching Indica se o erro veio do watchPosition.
 */
function handleLocationError(error, isWatching) {
    // ... (código desta função permanece exatamente o mesmo de antes) ...
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
    // alert(message); // Evitar alertas frequentes

    if (isWatching && error.code === error.PERMISSION_DENIED) {
       if (userLocationMarker) { userLocationMarker.setMap(null); userLocationMarker = null; }
       if (userLocationAccuracyCircle) { userLocationAccuracyCircle.setMap(null); userLocationAccuracyCircle = null; }
       if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; console.log("Monitoramento parado por negação de permissão."); }
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
                const userCoords = { lat: position.coords.latitude, lng: position.coords.longitude };
                initializeMapWithCoords(userCoords, 15); // Zoom maior
                updateUserMarkerAndAccuracy(position); // Cria marcador inicial

                // 2. Inicia o MONITORAMENTO CONTÍNUO (watchPosition)
                if (watchId === null) {
                    console.log("Iniciando monitoramento contínuo (watchPosition)...");
                    watchId = navigator.geolocation.watchPosition(
                        (newPosition) => { updateUserMarkerAndAccuracy(newPosition); }, // Atualiza marcador/círculo/verifica desvio
                        (error) => { handleLocationError(error, true); }, // Handler de erro (isWatching = true)
                        { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 } // Opções
                    );
                    console.log("Monitoramento iniciado com watchId:", watchId);
                }
            },
            (error) => { // ERRO ao obter posição inicial
                currentUserLocation = null;
                handleLocationError(error, false); // Handler de erro (isWatching = false)
                console.warn("Não foi possível obter localização inicial. Usando São Paulo.");
                const defaultCoords = { lat: -23.5505, lng: -46.6333 };
                initializeMapWithCoords(defaultCoords, 13); // Inicializa com SP
            },
             { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 } // Opções para getCurrentPosition
        );

    } else {
        // Navegador NÃO suporta geolocalização
        currentUserLocation = null;
        console.warn("Navegador não suporta Geolocalização. Usando São Paulo.");
        alert("Seu navegador não suporta Geolocalização.");
        const defaultCoords = { lat: -23.5505, lng: -46.6333 };
        initializeMapWithCoords(defaultCoords, 13); // Inicializa com SP
    }
}

// Função auxiliar para inicializar o mapa com coordenadas específicas
function initializeMapWithCoords(coords, zoomLevel) {
    // --- ATENÇÃO: Seu HTML usa 'map-container' como o div do mapa ---
    const mapDiv = document.getElementById('map-container'); // Usa o container diretamente
    if (!mapDiv) {
        console.error("ERRO CRÍTICO: Div 'map-container' não encontrada.");
        // Se mapDiv não existe, não adianta tentar colocar mensagem nele
        alert("Erro crítico: Container do mapa não encontrado!");
        return;
    }

     // Remove mensagem "Carregando mapa..." se existir
     const loadingMessage = mapDiv.querySelector('p');
     if (loadingMessage) {
         loadingMessage.remove();
     }

    try {
        map = new google.maps.Map(mapDiv, { // Passa o map-container
            center: coords,
            zoom: zoomLevel,
            mapId: "DEMO_MAP_ID", // Use sua Map ID se tiver
            // Opcional: desabilitar alguns controles padrão se quiser interface mais limpa
            // disableDefaultUI: true,
            // zoomControl: true,
            // mapTypeControl: false,
            // scaleControl: true,
            // streetViewControl: false,
            // rotateControl: false,
            // fullscreenControl: false
        });

        placesService = new google.maps.places.PlacesService(map);
        directionsService = new google.maps.DirectionsService();
        directionsRenderer = new google.maps.DirectionsRenderer({
             map: map, // Associa ao mapa
             suppressMarkers: false // Mostra marcadores A e B padrão da rota (pode mudar para true se quiser usar os seus)
        });

        console.log("Mapa e serviços do Google Maps prontos.");

        // Chama a configuração dos listeners APÓS o mapa estar pronto
        setupEventListeners();

    } catch (error) {
        console.error("ERRO ao inicializar o Google Maps:", error);
        mapDiv.innerHTML = `<p style="color: red; padding: 20px;">Erro ao carregar o mapa: ${error.message}. Verifique a chave da API e a conexão.</p>`;
    }
}

// --- Configuração dos Listeners (Chamada após initMap) ---
function setupEventListeners() {
    console.log("Configurando listeners de eventos...");

    // --- NOVO: Seletores para Modo Mapa ---
    appContainer = document.getElementById('app-container'); // Atribui à variável global
    const backButton = document.getElementById('back-button'); // Botão Voltar

    // Referências aos elementos HTML existentes
    const searchInput = document.getElementById('search-input');
    const addLocationBtn = document.getElementById('add-location-btn');
    const selectedLocationsList = document.getElementById('selected-locations-list');
    const calculateRouteBtn = document.getElementById('calculate-route-btn');
    const tourBarsNearbyBtn = document.getElementById('tour-bars-nearby-btn');
    const categoryButtons = document.querySelectorAll('.category-btn');
    const routeFoundBtn = document.getElementById('route-found-btn');

    // Verifica elementos essenciais
    if (!appContainer || !searchInput || !addLocationBtn || !selectedLocationsList || !calculateRouteBtn || !tourBarsNearbyBtn || !categoryButtons.length || !routeFoundBtn) {
        console.error('ERRO: Um ou mais elementos essenciais da interface não foram encontrados! Verifique os IDs no HTML.');
        // Não prosseguir se elementos básicos faltarem
        return;
    }
     // Verifica o botão Voltar separadamente, pois ele pode não ter sido adicionado ainda
     if (!backButton) {
         console.warn("AVISO: Botão #back-button não encontrado no HTML. Funcionalidade 'Voltar' do modo mapa não funcionará.");
     }


    // --- Configuração do Autocomplete (com setTimeout) ---
    setTimeout(() => {
        if (map && google.maps.places) {
            try {
                const autocomplete = new google.maps.places.Autocomplete(searchInput, {
                    // bindTo: 'bounds', // Tenta restringir ao viewport atual do mapa
                    // map: map, // Associa ao mapa para influenciar resultados
                    componentRestrictions: { country: "br" }, // Restringe ao Brasil
                    fields: ["name", "geometry.location", "place_id", "formatted_address"],
                    types: ['geocode', 'establishment'] // Tipos de locais
                });
                 // autocomplete.bindTo('bounds', map); // Tenta restringir à área visível

                autocomplete.addListener('place_changed', () => {
                    const place = autocomplete.getPlace();
                    if (place && place.geometry && place.geometry.location) {
                        selectedPlaceData = place;
                        console.log('Autocomplete: Local selecionado:', selectedPlaceData.name);
                         // Opcional: centralizar mapa no local selecionado
                         // map.setCenter(place.geometry.location);
                         // map.setZoom(15);
                    } else {
                        selectedPlaceData = null;
                        console.log('Autocomplete: Seleção inválida.');
                    }
                });

                searchInput.addEventListener('input', () => {
                    if (!searchInput.value) { selectedPlaceData = null; } // Limpa se campo vazio
                });
                console.log("Autocomplete inicializado.");

            } catch (e) {
                 console.error("ERRO ao inicializar Autocomplete:", e);
                 searchInput.placeholder = "Erro no Autocomplete";
                 searchInput.disabled = true;
                 addLocationBtn.disabled = true;
            }
        } else {
            console.error("Autocomplete não pôde ser inicializado (mapa ou lib places não prontos).");
            searchInput.placeholder = "Autocomplete indisponível";
            searchInput.disabled = true;
            addLocationBtn.disabled = true;
        }
    }, 500); // Atraso

    // --- Função para Adicionar Local à Lista e Mapa ---
    function addSelectedPlaceToList() {
        if (!selectedPlaceData || !selectedPlaceData.geometry || !selectedPlaceData.geometry.location) {
            alert("Digite um local e selecione uma sugestão válida antes de adicionar.");
            searchInput.focus();
            return;
        }

        const placeName = selectedPlaceData.name;
        const placePosition = selectedPlaceData.geometry.location;
        const placeId = selectedPlaceData.place_id;

        if (markers.some(item => item.placeId === placeId)) {
            alert(`"${placeName}" já está na lista.`);
            searchInput.value = ""; selectedPlaceData = null; searchInput.focus(); return;
        }

        console.log(`Adicionando manual: "${placeName}"`);
        const marker = new google.maps.Marker({ position: placePosition, map: map, title: placeName });
        markers.push({ name: placeName, position: placePosition, placeId: placeId, marker: marker });

        const li = document.createElement('li');
        li.dataset.placeId = placeId;
        const nameSpan = document.createElement('span'); nameSpan.textContent = placeName;
        const removeBtn = document.createElement('button'); removeBtn.textContent = 'X'; removeBtn.classList.add('remove-btn'); // Usa X para economizar espaço
        removeBtn.title = "Remover local"; // Tooltip
        li.appendChild(nameSpan); li.appendChild(removeBtn);
        selectedLocationsList.appendChild(li);

        searchInput.value = ""; selectedPlaceData = null; searchInput.focus();

         // Opcional: Ajustar zoom para incluir todos os marcadores manuais
         if (markers.length > 0) {
             const bounds = new google.maps.LatLngBounds();
             markers.forEach(item => bounds.extend(item.marker.getPosition()));
             if (userLocationMarker) bounds.extend(userLocationMarker.getPosition()); // Inclui usuário se visível
             map.fitBounds(bounds);
             if (markers.length === 1 && map.getZoom() > 15) map.setZoom(15); // Evita zoom excessivo em 1 ponto
         }
    }

    // Garante estado inicial do botão
    routeFoundBtn.disabled = true;

    // --- FUNÇÕES AUXILIARES INTERNAS ---
    function clearFoundMarkers() {
        console.log(`Limpando ${foundMarkers.length} marcadores encontrados.`);
        foundMarkers.forEach(marker => marker.setMap(null));
        foundMarkers.length = 0; // Limpa o array
        currentRouteResult = null; // Limpa rota associada à busca
        currentRouteRequest = null;
        if (routeFoundBtn) { routeFoundBtn.disabled = true; } // Desabilita botão
        // Limpa a rota do display
        if (directionsRenderer) { directionsRenderer.setDirections({ routes: [] }); }
    }

    // --- LISTENERS DE EVENTOS ---

    // Listener para TODOS os Botões de Categoria
    categoryButtons.forEach(button => {
        button.addEventListener('click', function() {
            const categoryType = this.dataset.category;
            console.log(`Categoria clicada: "${categoryType}"`);
            if (!map || !placesService) { alert("Mapa/Serviços não prontos."); return; }

            // Limpa resultados/rota anteriores ANTES da nova busca
            clearFoundMarkers();

            let searchLocation = currentUserLocation; // Prioriza localização atual
            let searchRadius = 5000; // Raio de 5km (ajuste conforme necessário)
            let request;

            if (searchLocation) {
                console.log(`Procurando por "${categoryType}" perto da localização atual...`);
                request = {
                     location: searchLocation,
                     radius: searchRadius, // Raio em metros
                     // type: [categoryType] // 'type' é mais restritivo, use 'keyword' ou 'query' para mais resultados
                     keyword: categoryType // 'keyword' tende a dar mais resultados que 'type'
                     // query: categoryType // 'query' pode ser usado com textSearch, não nearbySearch
                };
                 placesService.nearbySearch(request, handleSearchResults); // Usa nearbySearch
            } else {
                 // Se não tem localização, usa bounds do mapa (menos preciso)
                 console.log(`Procurando por "${categoryType}" na área visível do mapa...`);
                 if (!map.getBounds()) { alert("Área do mapa não definida."); return; }
                 request = {
                     bounds: map.getBounds(),
                     query: categoryType // Usa textSearch se baseado em bounds
                 };
                 placesService.textSearch(request, handleSearchResults); // Usa textSearch
            }
        });
    });

     // Função para lidar com os resultados da busca (nearbySearch ou textSearch)
     function handleSearchResults(results, status) {
         if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
             console.log(`Busca OK: ${results.length} locais encontrados.`);
             let bounds = new google.maps.LatLngBounds();
             let validMarkersCount = 0;

             results.forEach(place => {
                 if (place.geometry && place.geometry.location) {
                     const foundMarker = new google.maps.Marker({
                         map: map,
                         position: place.geometry.location,
                         title: place.name,
                          // icon: 'url_para_icone_customizado.png' // Opcional: ícone diferente
                     });
                     // Adiciona info extra ao marcador para uso posterior se necessário
                     foundMarker.placeData = place;
                     foundMarkers.push(foundMarker); // Adiciona ao array de marcadores encontrados
                     bounds.extend(place.geometry.location); // Expande bounds para incluir este local
                     validMarkersCount++;
                 } else {
                     console.warn("Local encontrado sem geometria:", place.name);
                 }
             });

             if (validMarkersCount > 0) {
                 console.log(`${validMarkersCount} marcadores válidos criados.`);
                 if (currentUserLocation) { // Inclui localização do usuário nos bounds se disponível
                    bounds.extend(currentUserLocation);
                 }
                 map.fitBounds(bounds); // Ajusta o mapa para mostrar todos os marcadores e usuário
                 if (map.getZoom() > 16) map.setZoom(16); // Limita o zoom máximo para não ficar muito perto

                 routeFoundBtn.disabled = false; // HABILITA o botão "Traçar Rota"
                 console.log("Botão 'Traçar Rota' HABILITADO.");
             } else {
                 console.warn("Busca retornou resultados, mas nenhum com localização válida.");
                 alert("Nenhum local encontrado com localização válida.");
                 routeFoundBtn.disabled = true;
             }

         } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
             console.log("Busca não retornou resultados.");
             alert("Nenhum local encontrado para esta categoria na área.");
             routeFoundBtn.disabled = true;
         } else {
             console.error("Erro na busca por locais: " + status);
             alert("Erro ao buscar locais: " + status);
             routeFoundBtn.disabled = true;
         }
     }


    // Botão "Traçar Rota" (para locais encontrados na BUSCA por categoria)
        // Botão "Traçar Rota" (para locais encontrados na BUSCA por categoria)
        routeFoundBtn.addEventListener('click', function() {
            // Condições iniciais
            if (!directionsService || !directionsRenderer) {
                alert("Serviço de rotas não pronto. Aguarde ou recarregue.");
                console.error("Tentativa de traçar rota sem directionsService/Renderer.");
                return;
            }
            if (foundMarkers.length === 0) {
                alert("Nenhum local foi encontrado para incluir na rota. Faça uma busca por categoria primeiro.");
                console.warn("Tentativa de traçar rota sem foundMarkers.");
                return;
            }
    
            console.log("Botão 'Traçar Rota' clicado. Solicitando localização...");
            this.disabled = true; // Desabilita o botão
            this.textContent = "Localizando..."; // Feedback
    
            // --- >> SOLICITA GEOLOCALIZAÇÃO AQUI << ---
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        // --- SUCESSO AO OBTER LOCALIZAÇÃO ---
                        this.textContent = "Calculando..."; // Atualiza feedback
                        const userPos = {
                            lat: position.coords.latitude,
                            lng: position.coords.longitude
                        };
                        currentUserLocation = userPos; // Atualiza a variável global
                        console.log("Localização obtida para traçar rota:", userPos);
    
                        // Atualiza o marcador do usuário no mapa (ou cria se não existir)
                        updateUserMarkerAndAccuracy(position); // Usa a função existente
    
                        // --- PROSSEGUE COM O CÁLCULO DA ROTA ---
                        console.log("Calculando rota da localização atual para locais encontrados...");
                        directionsRenderer.setDirections({ routes: [] }); // Limpa rota anterior
    
                        const waypoints = foundMarkers.map(marker => ({
                            location: marker.getPosition(),
                            stopover: true
                        }));
    
                        let originPoint = userPos; // Usa a localização recém-obtida
                        let destinationPoint;
                        let waypointsForRequest = [];
    
                        if (waypoints.length === 1) {
                            destinationPoint = waypoints[0].location;
                        } else {
                            destinationPoint = waypoints[waypoints.length - 1].location;
                            waypointsForRequest = waypoints.slice(0, -1);
                        }
    
                        const request = {
                            origin: originPoint,
                            destination: destinationPoint,
                            waypoints: waypointsForRequest,
                            optimizeWaypoints: true,
                            travelMode: google.maps.TravelMode.DRIVING
                        };
    
                        console.log("Enviando requisição de rota:", request);
                        directionsService.route(request, (result, status) => {
                            if (status === google.maps.DirectionsStatus.OK) {
                                console.log("Rota calculada com sucesso:", result);
                                directionsRenderer.setDirections(result);
                                currentRouteResult = result;
                                currentRouteRequest = request;
                                isRecalculating = false;
    
                                // --- ENTRAR NO MODO MAPA ---
                                if (appContainer) {
                                    appContainer.classList.add('map-only-mode');
                                    console.log("Entrando no Modo Mapa.");
                                    setTimeout(() => {
                                        if (map) {
                                            google.maps.event.trigger(map, 'resize');
                                            if (result.routes && result.routes[0] && result.routes[0].bounds) {
                                                map.fitBounds(result.routes[0].bounds);
                                            }
                                            console.log("Mapa redimensionado para Modo Mapa.");
                                        }
                                    }, 350);
                                }
                                this.textContent = "Rota Traçada"; // Texto final
    
                            } else {
                                console.error('Erro ao calcular a rota: ' + status);
                                alert('Erro ao calcular a rota: ' + status);
                                currentRouteResult = null; currentRouteRequest = null;
                                // Reabilita o botão e restaura texto se falhar
                                this.disabled = foundMarkers.length === 0;
                                this.textContent = "Traçar Rota";
                            }
                        }); // Fim callback directionsService.route
    
                    },
                    (error) => {
                        // --- ERRO AO OBTER LOCALIZAÇÃO ---
                        console.error("Erro ao obter localização no clique:", error);
                        handleLocationError(error, false); // Usa nosso handler de erro
                        alert("Não foi possível obter sua localização para traçar a rota. Verifique as permissões.");
                        // Reabilita o botão e restaura texto
                        this.disabled = foundMarkers.length === 0;
                        this.textContent = "Traçar Rota";
                    },
                    // Opções para getCurrentPosition (exigir precisão alta pode demorar mais)
                    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 } // Tenta obter localização fresca
                ); // Fim chamada getCurrentPosition
            } else {
                // Navegador não suporta geolocalização
                alert("Geolocalização não é suportada neste navegador.");
                this.disabled = foundMarkers.length === 0; // Reabilita se houver marcadores
                this.textContent = "Traçar Rota";
            }
        }); // Fim listener routeFoundBtn

    // Botão ADICIONAR Local Manualmente
    addLocationBtn.addEventListener('click', addSelectedPlaceToList);

    // Adicionar com Enter no Input
    searchInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault(); // Impede envio de formulário (caso exista)
            addSelectedPlaceToList(); // Tenta adicionar o local selecionado
        }
    });

    // Botão CALCULAR Rota Manualmente (Locais da Lista)
    calculateRouteBtn.addEventListener('click', function() {
        if (markers.length < 2) { alert("Adicione pelo menos 2 locais à lista."); return; }
        if (!directionsService || !directionsRenderer) { alert("Serviço de rotas não pronto."); return; }

        console.log("Calculando rota manual...");
        directionsRenderer.setDirections({ routes: [] }); // Limpa rota anterior
        currentRouteResult = null; // Limpa dados da rota antiga
        currentRouteRequest = null; // Limpa requisição antiga

        // Prepara waypoints (todos exceto o primeiro e o último)
        const waypoints = markers.slice(1, -1).map(item => ({
            location: item.marker.getPosition(), // Usa a posição do marcador guardado
            stopover: true
        }));
        const origin = markers[0].marker.getPosition(); // Posição do primeiro marcador
        const destination = markers[markers.length - 1].marker.getPosition(); // Posição do último

        const request = {
            origin: origin,
            destination: destination,
            waypoints: waypoints,
            optimizeWaypoints: true, // Otimiza ordem das paradas
            travelMode: google.maps.TravelMode.DRIVING
        };
        console.log("Requisição rota manual:", request);

        directionsService.route(request, (result, status) => {
            if (status === google.maps.DirectionsStatus.OK) {
                console.log("Rota manual calculada OK:", result);
                directionsRenderer.setDirections(result);
                // DECISÃO: Entrar no modo mapa também para rota manual?
                // Se sim, descomente as linhas abaixo e ajuste se necessário
                 /*
                 currentRouteResult = result; // Guarda para possível recálculo
                 currentRouteRequest = request;
                 isRecalculating = false;
                 if (appContainer) {
                     appContainer.classList.add('map-only-mode');
                     console.log("Entrando no Modo Mapa (Rota Manual).");
                     setTimeout(() => {
                         if (map) {
                             google.maps.event.trigger(map, 'resize');
                             if (result.routes && result.routes[0] && result.routes[0].bounds) {
                                  map.fitBounds(result.routes[0].bounds);
                             }
                             console.log("Mapa redimensionado para Modo Mapa.");
                         }
                     }, 350);
                 }
                 */

            } else {
                console.error('Erro ao calcular rota manual: ' + status);
                alert('Erro ao calcular rota manual: ' + status);
            }
        });
    });

    // Listener para Remover Item da Lista Manual
    selectedLocationsList.addEventListener('click', function(event) {
        if (event.target.classList.contains('remove-btn')) {
            const listItem = event.target.closest('li'); if (!listItem) return;
            const placeIdToRemove = listItem.dataset.placeId; if (!placeIdToRemove) return;
            console.log(`Removendo placeId: ${placeIdToRemove}`);
            const indexToRemove = markers.findIndex(item => item.placeId === placeIdToRemove);

            if (indexToRemove !== -1) {
                markers[indexToRemove].marker.setMap(null); // Remove marcador do mapa
                const removedItem = markers.splice(indexToRemove, 1)[0]; // Remove do array
                console.log(`Removido da lista manual: "${removedItem.name}"`);
                listItem.remove(); // Remove da lista visual

                // Opcional: Recalcular bounds se remover item
                 if (markers.length > 0) {
                     const bounds = new google.maps.LatLngBounds();
                     markers.forEach(m => bounds.extend(m.marker.getPosition()));
                     if (userLocationMarker) bounds.extend(userLocationMarker.getPosition());
                     map.fitBounds(bounds);
                 } else if (userLocationMarker) {
                      // Se não sobrou nenhum, centraliza no usuário (se existir)
                      // map.setCenter(userLocationMarker.getPosition());
                      // map.setZoom(15);
                 }
                // Se uma rota manual estava exibida, ela pode ficar inválida. Limpar?
                 // directionsRenderer.setDirections({ routes: [] });
                 // currentRouteResult = null; currentRouteRequest = null;

            } else {
                console.warn("Item não encontrado no array 'markers' para remover (placeId não correspondeu).");
            }
        }
    });

    // Botão "Iniciar Tour Próximo" (Ainda como Placeholder)
    tourBarsNearbyBtn.addEventListener('click', function() {
        alert("Funcionalidade 'Iniciar Tour Próximo' ainda não implementada.");
        console.log("Botão 'Tour Próximo' clicado (não implementado).");
        // Aqui você colocaria a lógica para buscar bares próximos E traçar uma rota entre eles
    });

    // --- NOVO: Listener para o Botão Voltar ---
    if (backButton && appContainer) {
        backButton.addEventListener('click', () => {
            console.log("Botão Voltar clicado.");
            appContainer.classList.remove('map-only-mode'); // Remove a classe para voltar ao normal
            console.log("Saindo do Modo Mapa.");

            // Opcional: Limpar a rota exibida ao voltar
            if (directionsRenderer) {
                directionsRenderer.setDirections({ routes: [] });
                console.log("Rota limpa do display.");
            }
            // Opcional: Limpar marcadores da busca anterior (ou mantê-los?)
            // clearFoundMarkers(); // Descomente se quiser limpar os locais encontrados ao voltar

            // Limpa dados da rota atual para evitar recálculos indesejados
            currentRouteResult = null;
            currentRouteRequest = null;

            // Forçar redimensionamento do mapa APÓS transição CSS
            setTimeout(() => {
                if (map) {
                    google.maps.event.trigger(map, 'resize');
                    console.log("Mapa redimensionado para layout normal.");
                    // Opcional: Ajustar zoom para mostrar marcadores relevantes (usuário, manuais, encontrados)
                     const bounds = new google.maps.LatLngBounds();
                     let hasPoints = false;
                     if (userLocationMarker) { bounds.extend(userLocationMarker.getPosition()); hasPoints = true; }
                     markers.forEach(m => { bounds.extend(m.marker.getPosition()); hasPoints = true; });
                     // Incluir foundMarkers se não foram limpos?
                     // foundMarkers.forEach(fm => { bounds.extend(fm.getPosition()); hasPoints = true; });

                     if (hasPoints) {
                         map.fitBounds(bounds);
                         if (map.getZoom() > 17) map.setZoom(17); // Limita zoom
                     }
                }
            }, 350); // Tempo um pouco maior que a transição CSS

            // Reabilitar o botão "Traçar Rota" se ainda houver locais encontrados
            if (routeFoundBtn) {
                 routeFoundBtn.disabled = foundMarkers.length === 0;
                 routeFoundBtn.textContent = "Traçar Rota"; // Restaura texto
            }
        });
    }
    // --- FIM Listener Botão Voltar ---

    // Remover item de exemplo (se existir no HTML original) - seguro manter
    const exampleItem = selectedLocationsList.querySelector('li[data-example]'); // Exemplo: se tivesse data-example
    if (exampleItem) { exampleItem.remove(); }

    console.log("Configuração dos listeners concluída.");

} // --- Fim da função setupEventListeners ---

// Chamada inicial (via callback da API do Google Maps na tag <script>)
console.log("Aguardando API do Google Maps chamar initMap...");