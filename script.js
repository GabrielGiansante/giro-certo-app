// ========================================================================
// Rota Fácil - script.js
// ========================================================================

// =======================================================
// --- Variáveis Globais ---
// =======================================================

// --- Mapa e Serviços Google ---
let map;
let placesService;
let directionsService = null;
let directionsRenderer = null;

// --- Estado do Aplicativo ---
let foundMarkers = [];
let currentUserLocation = null;
let currentRouteResult = null;
let currentRouteRequest = null;
let isRecalculating = false;
let isFilterActive = false;
let currentFilterableMarkers = [];

// --- Marcador do Usuário ---
let userLocationMarker = null;
let userLocationAccuracyCircle = null;
let watchId = null;

// --- Elementos da UI ---
let appContainer = null;
let routeFoundBtn = null;
let backButton = null;
let searchInput = null;
let addLocationBtn = null;
let selectedLocationsList = null;
let autocomplete = null;
let categoryTitle = null;
let categoryButtonsContainer = null;
let filterResultsBtn = null;
let actionButtonsContainer = null;

// --- Variáveis para a Câmera com Overlay ---
let cameraOverlay = null;
let cameraView = null;
let captureBtn = null;
let cancelCaptureBtn = null;
let stream = null;


// =======================================================
// --- Funções de Inicialização e Localização ---
// =======================================================

// --- Reset Inicial ---
userLocationMarker = null; userLocationAccuracyCircle = null;
if (navigator.geolocation && typeof watchId !== 'undefined' && watchId !== null) { try { navigator.geolocation.clearWatch(watchId); } catch (e) { console.error(">>> Script Init: Erro ao limpar watchId:", e); } }
watchId = null; foundMarkers = []; console.log(">>> Script Init: Resetado.");
// --------------------

function initMap() {
    console.log(">>> initMap: Iniciando...");
    userLocationMarker = null;
    userLocationAccuracyCircle = null;
    console.log(">>> initMap: Marcador/Círculo resetados para null.");

    if (navigator.geolocation) {
        console.log(">>> initMap: Tentando obter localização inicial...");
        navigator.geolocation.getCurrentPosition(
            (position) => {
                console.log(">>> initMap: Localização inicial OBTIDA.");
                currentUserLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
                initializeMapAndServices(currentUserLocation, 15);
            },
            (error) => {
                console.warn(">>> initMap: Erro ao obter localização inicial.");
                currentUserLocation = null;
                const defaultCoords = { lat: -23.5505, lng: -46.6333 };
                initializeMapAndServices(defaultCoords, 13);
                handleLocationError(error, false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    } else {
        console.warn(">>> initMap: Geolocalização não suportada.");
        currentUserLocation = null;
        const defaultCoords = { lat: -23.5505, lng: -46.6333 };
        initializeMapAndServices(defaultCoords, 13);
    }
}

function initializeMapAndServices(initialCoords, initialZoom) {
    console.log(">>> initializeMapAndServices: Iniciando...");
    const mapDiv = document.getElementById('map-container');
    if (!mapDiv) { console.error("!!! ERRO CRÍTICO: #map-container não encontrado!"); return; }
    const loadingP = mapDiv.querySelector('p'); if (loadingP) loadingP.remove();

    try {
        console.log(">>> initializeMapAndServices: Criando mapa...");
        map = new google.maps.Map(mapDiv, { center: initialCoords, zoom: initialZoom });
        console.log(">>> initializeMapAndServices: Mapa criado.");
        placesService = new google.maps.places.PlacesService(map);
        console.log(">>> initializeMapAndServices: PlacesService criado.");
        directionsService = new google.maps.DirectionsService();
        directionsRenderer = new google.maps.DirectionsRenderer({ map: map, suppressMarkers: false });
        console.log(">>> initializeMapAndServices: Directions criados.");

        console.log(">>> initializeMapAndServices: Serviços Google prontos.");
        setupEventListeners(); // Chama listeners DEPOIS

        if (currentUserLocation) {
             const initialPositionLike = { coords: { latitude: currentUserLocation.lat, longitude: currentUserLocation.lng, accuracy: 20, heading: null } };
             updateUserMarkerAndAccuracy(initialPositionLike);
        }
        startWatchingPosition(); // Inicia watch DEPOIS

    } catch (error) {
        console.error("!!! ERRO GERAL em initializeMapAndServices:", error);
        if (mapDiv) { mapDiv.innerHTML = `<p style="color: red;">ERRO: ${error.message}</p>`; }
    }
}

function startWatchingPosition() {
     if (!navigator.geolocation) { console.warn(">>> startWatchingPosition: Geo não suportada."); return; }
     if (watchId !== null) { try { navigator.geolocation.clearWatch(watchId); } catch(e) { console.error("Erro ao limpar watchId:", e); } watchId = null; }
     console.log(">>> startWatchingPosition: Tentando iniciar...");
     try {
         watchId = navigator.geolocation.watchPosition(
             (newPosition) => { updateUserMarkerAndAccuracy(newPosition); },
             (error) => { console.error("!!! watchPosition: ERRO:", error.code, error.message); handleLocationError(error, true); },
             { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
         );
         console.log(`>>> startWatchingPosition: Iniciado com watchId: ${watchId}`);
     } catch (watchError) { console.error("!!! ERRO GERAL ao iniciar watchPosition:", watchError); watchId = null; }
}

function updateUserMarkerAndAccuracy(position) {
    if (!position || !position.coords) { return; }
    if (!map || typeof map.setCenter !== 'function' || typeof map.getProjection !== 'function') { return; }
    
    const pos = { lat: position.coords.latitude, lng: position.coords.longitude };
    currentUserLocation = pos;

    const performVisualUpdate = () => {
        const accuracy = position.coords.accuracy;
        const heading = position.coords.heading;

        if (userLocationAccuracyCircle) {
            userLocationAccuracyCircle.setCenter(pos); userLocationAccuracyCircle.setRadius(accuracy);
        } else {
            userLocationAccuracyCircle = new google.maps.Circle({ map: map, center: pos, radius: accuracy, strokeColor: '#1a73e8', strokeOpacity: 0.4, strokeWeight: 1, fillColor: '#1a73e8', fillOpacity: 0.1, zIndex: 1 });
        }

        let iconConfig = { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, fillColor: '#1a73e8', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2, scale: 6, anchor: new google.maps.Point(0, 2.5), rotation: 0 };
        if (heading !== null && !isNaN(heading) && typeof heading === 'number') { iconConfig.rotation = heading; }

        if (userLocationMarker) {
            userLocationMarker.setIcon(iconConfig); userLocationMarker.setPosition(pos);
            if (userLocationMarker.getMap() !== map) { userLocationMarker.setMap(map); }
        } else {
            userLocationMarker = new google.maps.Marker({ position: pos, map: map, title: 'Sua localização', icon: iconConfig, zIndex: 2 });
        }
    };

    if (map.getProjection()) { performVisualUpdate(); }
    else {
         google.maps.event.addListenerOnce(map, 'tilesloaded', performVisualUpdate);
    }
}

function handleLocationError(error, isWatching) {
    let prefix = isWatching ? 'Erro Watch' : 'Erro Get';
    console.warn(`${prefix}: ${error.message} (Code: ${error.code})`);

    if (isWatching && error.code === error.PERMISSION_DENIED) {
       if (userLocationMarker) { userLocationMarker.setMap(null); userLocationMarker = null; }
       if (userLocationAccuracyCircle) { userLocationAccuracyCircle.setMap(null); userLocationAccuracyCircle = null; }
       if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
    }
}


// =======================================================
// --- Configuração dos Listeners de Eventos (UI) ---
// =======================================================
function setupEventListeners() {
    console.log(">>> setupEventListeners: Configurando...");

    // Pega referências dos elementos da UI
    appContainer = document.getElementById('app-container');
    backButton = document.getElementById('back-button');
    searchInput = document.getElementById('search-input');
    addLocationBtn = document.getElementById('add-location-btn');
    selectedLocationsList = document.getElementById('selected-locations-list');
    const categoryButtons = document.querySelectorAll('.category-btn');
    routeFoundBtn = document.getElementById('route-found-btn');
    categoryTitle = document.getElementById('category-title');
    categoryButtonsContainer = document.getElementById('category-buttons-container');
    filterResultsBtn = document.getElementById('filter-results-btn');
    actionButtonsContainer = document.getElementById('action-buttons-container');
    
    // Pega referências dos elementos da Câmera
    cameraOverlay = document.getElementById('camera-overlay');
    cameraView = document.getElementById('camera-view');
    captureBtn = document.getElementById('capture-btn');
    cancelCaptureBtn = document.getElementById('cancel-capture-btn');

    // Verifica se todos os elementos essenciais existem
    let missingElement = null;
    if (!appContainer) missingElement = '#app-container';
    else if (!searchInput) missingElement = '#search-input';
    else if (!addLocationBtn) missingElement = '#add-location-btn';
    else if (!selectedLocationsList) missingElement = '#selected-locations-list';
    else if (!categoryButtons || categoryButtons.length === 0) missingElement = '.category-btn';
    else if (!routeFoundBtn) missingElement = '#route-found-btn';
    else if (!categoryTitle) missingElement = '#category-title';
    else if (!categoryButtonsContainer) missingElement = '#category-buttons-container';
    else if (!filterResultsBtn) missingElement = '#filter-results-btn';
    else if (!actionButtonsContainer) missingElement = '#action-buttons-container';
    else if (!cameraOverlay) missingElement = '#camera-overlay';
    else if (!cameraView) missingElement = '#camera-view';
    else if (!captureBtn) missingElement = '#capture-btn';
    else if (!cancelCaptureBtn) missingElement = '#cancel-capture-btn';
    
    if (missingElement) { 
        console.error(`ERRO FATAL: Elemento "${missingElement}" não encontrado!`); 
        return; 
    }
    
    // --- Listener para o Botão de Scanner OCR ---
    const scanAddressBtn = document.getElementById('scan-address-btn');
    scanAddressBtn.addEventListener('click', () => {
        startCamera();
    });

    // --- Listener Botões de Categoria ---
    categoryButtons.forEach(button => {
        button.addEventListener('click', function() {
            const categoryType = this.dataset.category;
            if (!map || !placesService) { alert("Mapa/Places não pronto!"); return; }
            if(routeFoundBtn) routeFoundBtn.disabled = true;
            clearFoundMarkers();
            
            if (categoryTitle) categoryTitle.style.display = 'none';
            if (categoryButtonsContainer) categoryButtonsContainer.style.display = 'none';

            let request;
            if (currentUserLocation) {
                request = { location: currentUserLocation, radius: 5000, keyword: categoryType };
                placesService.nearbySearch(request, (results, status) => handleSearchResults(results, status, true));
            } else {
                const bounds = map.getBounds();
                if (!bounds) { alert("Área do mapa indefinida."); return; }
                request = { bounds: bounds, query: categoryType };
                placesService.textSearch(request, (results, status) => handleSearchResults(results, status, false));
            }
        });
    });

    // --- Listener Botão "Traçar Rota" ---
    routeFoundBtn.addEventListener('click', function() {
        if (!directionsService || !directionsRenderer || !foundMarkers || foundMarkers.length === 0 || !map) return;
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

                    if (waypointsLimited.length === 1) { 
                        destinationPoint = waypointsLimited[0].location; 
                    } else { 
                        destinationPoint = waypointsLimited.pop().location; 
                        waypointsForRequest = waypointsLimited; 
                    }

                    const request = { origin: originPoint, destination: destinationPoint, waypoints: waypointsForRequest, optimizeWaypoints: true, travelMode: google.maps.TravelMode.DRIVING };

                    directionsService.route(request, (result, status) => {
                        if (status === google.maps.DirectionsStatus.OK) {
                            directionsRenderer.setDirections(result);
                            currentRouteResult = result; 
                            currentRouteRequest = request; 
                            isRecalculating = false;
                            if (appContainer) appContainer.classList.add('map-only-mode');
                            setTimeout(() => { if (map) { google.maps.event.trigger(map, 'resize'); if (result.routes[0].bounds) { map.fitBounds(result.routes[0].bounds); } } }, 350);
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
                    handleLocationError(error, false);
                }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
            );
        } else {
            alert("Geolocalização não suportada.");
        }
    });

    // --- Listener Botão Adicionar Manual (sem ação direta) ---
    addLocationBtn.addEventListener('click', () => console.log("Botão Adicionar Manual clicado - Ação via seleção do Autocomplete."));
    
    // --- Configuração do Autocomplete ---
    setTimeout(() => {
        if (searchInput && map && typeof google !== 'undefined' && google.maps && google.maps.places) {
            try {
                autocomplete = new google.maps.places.Autocomplete(searchInput, { componentRestrictions: { country: "br" }, fields: ["place_id", "geometry", "name", "formatted_address"] });
                autocomplete.bindTo('bounds', map);
                autocomplete.addListener('place_changed', () => {
                    const place = autocomplete.getPlace();
                    if (!place.geometry || !place.geometry.location) return;
                    if (foundMarkers.some(marker => marker.placeId === place.place_id)) {
                        alert(`"${place.name}" já foi adicionado.`);
                        searchInput.value = '';
                        return;
                    }
                    const manualMarker = new google.maps.Marker({ map: map, position: place.geometry.location, title: place.name });
                    manualMarker.placeId = place.place_id;
                    foundMarkers.push(manualMarker);
                    addPlaceToList(place.name, place.formatted_address, manualMarker.placeId);
                    map.panTo(place.geometry.location);
                    searchInput.value = '';
                    if (routeFoundBtn) routeFoundBtn.disabled = false;
                });
            } catch (e) { console.error("!!! ERRO ao inicializar Autocomplete:", e); }
        } else { console.error("Autocomplete não iniciado."); }
    }, 1500);

    // --- Listener para Remover Itens da Lista Manual ---
    selectedLocationsList.addEventListener('click', function(event) {
        if (event.target && event.target.classList.contains('remove-btn')) {
            const listItem = event.target.closest('li');
            const placeIdToRemove = listItem.dataset.placeId;
            if (!placeIdToRemove) return;

            let markerIndex = foundMarkers.findIndex(marker => marker.placeId === placeIdToRemove);
            if (markerIndex > -1) {
                foundMarkers[markerIndex].setMap(null);
                foundMarkers.splice(markerIndex, 1);
                listItem.remove();
                if (routeFoundBtn) routeFoundBtn.disabled = foundMarkers.length === 0;
            } else {
                listItem.remove();
            }
        }
    });

    // --- Listener Botão Voltar ---
    if (backButton && appContainer) {
        backButton.addEventListener('click', () => alert("Funcionalidade do Botão Voltar desativada."));
    }
    
    // --- Listener para o Botão de Filtro ---
    if (filterResultsBtn) {
        filterResultsBtn.addEventListener('click', toggleFilter);
    }

    console.log(">>> setupEventListeners: Concluído.");
}


// =======================================================
// --- Funções de Manipulação de Resultados e UI ---
// =======================================================

function handleSearchResults(results, status, nearbyUsed) {
    console.log(`>>> handleSearchResults (${nearbyUsed ? 'Nearby' : 'TextSearch'}): Status: "${status}".`);
    currentFilterableMarkers = [];

    if (filterResultsBtn) {
        if (nearbyUsed && status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
            filterResultsBtn.style.display = 'block';
            filterResultsBtn.textContent = 'Filtrar por lugares mais relevantes';
            filterResultsBtn.classList.remove('active-filter');
            isFilterActive = false;
        } else {
            filterResultsBtn.style.display = 'none';
        }
    }
    
    if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
        let bounds = new google.maps.LatLngBounds();
        results.forEach(place => {
            if (place.name && place.geometry && place.geometry.location) {
                const categoryMarker = new google.maps.Marker({ position: place.geometry.location, map: map, title: `${place.name} (Nota: ${place.rating || 'N/A'})` });
                categoryMarker.placeData = { rating: place.rating, user_ratings_total: place.user_ratings_total };
                categoryMarker.isManual = false; 
                foundMarkers.push(categoryMarker); 
                if (nearbyUsed) currentFilterableMarkers.push(categoryMarker);
                bounds.extend(place.geometry.location);
            }
        });

        if (currentUserLocation) bounds.extend(currentUserLocation);
        foundMarkers.forEach(marker => { if (marker.getMap() === map) { bounds.extend(marker.getPosition()); } });
        if (!bounds.isEmpty()) { map.fitBounds(bounds); if (map.getZoom() > 16) map.setZoom(16); }
        if (routeFoundBtn) routeFoundBtn.disabled = false;
    } else {
         if (routeFoundBtn) routeFoundBtn.disabled = foundMarkers.length === 0;
    }
}

function addPlaceToList(name, address, placeId) {
    if (!selectedLocationsList || !placeId) return;
    const addedMarker = foundMarkers.find(m => m.placeId === placeId);
    if (addedMarker) addedMarker.isManual = true;

    const listItem = document.createElement('li');
    listItem.dataset.placeId = placeId;
    let displayText = name;
    if (address) {
        let shortAddress = address.split(',')[0];
        if (shortAddress.toLowerCase() !== name.toLowerCase()) { displayText += ` (${shortAddress})`; }
    }
    listItem.textContent = displayText;
    const removeButton = document.createElement('button');
    removeButton.textContent = 'X';
    removeButton.classList.add('remove-btn');
    removeButton.style.cssText = 'margin-left:8px; padding:2px 5px; font-size:0.8em; cursor:pointer; color:red; border:1px solid red; background:none;';
    listItem.appendChild(removeButton);
    selectedLocationsList.appendChild(listItem);
}

function clearFoundMarkers() {
    console.log(`>>> clearFoundMarkers: Limpando ${foundMarkers.length} marcadores.`);
    currentFilterableMarkers = []; 
    resetUI();
    foundMarkers.forEach(marker => marker.setMap(null));
    foundMarkers = [];
    if(selectedLocationsList) selectedLocationsList.innerHTML = '';
    if (routeFoundBtn) routeFoundBtn.disabled = true;
}

function resetUI() {
    console.log(">>> resetUI: Resetando interface para estado inicial...");
    if (categoryTitle) categoryTitle.style.display = 'block'; 
    if (categoryButtonsContainer) categoryButtonsContainer.style.display = 'flex';
    if (filterResultsBtn) filterResultsBtn.style.display = 'none';
    isFilterActive = false;
}

function toggleFilter() {
    isFilterActive = !isFilterActive;
    applyFilters();
    if (filterResultsBtn) {
        if (isFilterActive) {
            filterResultsBtn.textContent = 'Mostrar todos os resultados';
            filterResultsBtn.classList.add('active-filter');
        } else {
            filterResultsBtn.textContent = 'Filtrar por lugares mais relevantes';
            filterResultsBtn.classList.remove('active-filter');
        }
    }
}

function applyFilters() {
    console.log(`>>> applyFilters: Aplicando filtro (Ativo: ${isFilterActive})`);
    const minRating = 4.0;
    const minReviews = 15;
    foundMarkers.forEach(marker => {
        if (!marker || typeof marker.setVisible !== 'function') return;
        if (marker.isManual) {
            marker.setVisible(true);
        } else if (marker.placeData) {
            let shouldShow = true;
            if (isFilterActive) {
                const rating = marker.placeData.rating || 0;
                const reviews = marker.placeData.user_ratings_total || 0;
                if (rating < minRating || reviews < minReviews) {
                    shouldShow = false;
                }
            }
            marker.setVisible(shouldShow);
        } else {
             marker.setVisible(true);
        }
    });
}


// ========================================================
// =========  FUNÇÕES PARA A CÂMERA COM OVERLAY  ==========
// ========================================================
async function startCamera() {
    if (!cameraOverlay || !cameraView) { alert("Erro: Elementos da câmera não foram encontrados."); return; }
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        cameraView.srcObject = stream;
        cameraView.play();
        cameraOverlay.classList.remove('hidden');
        captureBtn.onclick = captureImage;
        cancelCaptureBtn.onclick = stopCamera;
    } catch (err) {
        console.error("Erro ao acessar a câmera: ", err);
        alert("Não foi possível acessar a câmera. Verifique as permissões do navegador.");
    }
}

function stopCamera() {
    if (stream) stream.getTracks().forEach(track => track.stop());
    cameraOverlay.classList.add('hidden');
    stream = null;
}

function captureImage() {
    if (!cameraView) {
        console.error("PISTA DE ERRO: Função captureImage chamada, mas cameraView não existe.");
        return;
    }
    console.log("PISTA 1: Botão 'Capturar' clicado. Função captureImage iniciada.");

    const canvas = document.createElement('canvas');
    const videoWidth = cameraView.videoWidth;
    const videoHeight = cameraView.videoHeight;
    
    // ... (cálculos de corte, que já estão corretos) ...
    const cropWidthPercent = 0.85;
    const cropHeightPercent = 0.35;
    const cropWidth = videoWidth * cropWidthPercent;
    const cropHeight = videoHeight * cropHeightPercent;
    const cropX = (videoWidth - cropWidth) / 2;
    const cropY = (videoHeight - cropHeight) / 2;

    canvas.width = cropWidth;
    canvas.height = cropHeight;

    console.log("PISTA 2: Canvas criado e dimensionado. Desenhando imagem cortada...");
    const context = canvas.getContext('2d');
    context.drawImage(cameraView, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    console.log("PISTA 3: Imagem cortada desenhada no canvas.");

    stopCamera();

    const imageDataURL = canvas.toDataURL();
    console.log("PISTA 4: Imagem convertida para DataURL. Chamando processImageWithTesseract...");
    
    processImageWithTesseract(imageDataURL);
}

async function processImageWithTesseract(imageData) {
    console.log("PISTA 5: Função processImageWithTesseract iniciada.");
    scanAddressBtn.textContent = '...';
    searchInput.value = 'Reconhecendo texto...';
    try {
        console.log("PISTA 6: Chamando Tesseract.recognize...");
        const { data: { text } } = await Tesseract.recognize(
            imageData,
            'por',
            { logger: m => console.log(`Tesseract: ${m.status} (${(m.progress * 100).toFixed(0)}%)`) }
        );
        console.log("PISTA 7: Tesseract finalizado. Texto bruto: ", text);
        
        const extractedAddress = extractAddressFromText(text);
        console.log("PISTA 8: Endereço extraído: ", extractedAddress);

        if (searchInput) {
            searchInput.value = extractedAddress;
            console.log("PISTA 9: Endereço inserido no campo de busca.");
        }
        scanAddressBtn.textContent = '📷';
    } catch (err) {
        console.error("PISTA DE ERRO FINAL: Ocorreu um erro no bloco try/catch.", err);
        alert("Não foi possível ler o texto da imagem.");
        searchInput.value = '';
        scanAddressBtn.textContent = '📷';
    }
}


function extractAddressFromText(fullText) {
    const lines = fullText.split('\n');
    const addressKeywords = ['rua', 'av', 'av.', 'avenida', 'praça', 'alameda', 'travessa', 'cep', 'bairro', 'nº', 'no.', 'numero'];
    let extractedAddress = '';
    for (const line of lines) {
        const lowerLine = line.toLowerCase();
        if (addressKeywords.some(keyword => lowerLine.includes(keyword))) {
            extractedAddress += line + ' ';
        }
    }
    if (extractedAddress.trim() === '') {
        return fullText.replace(/\n/g, ' ');
    }
    return extractedAddress.trim();
}

// Chamada inicial
console.log("Aguardando API do Google Maps chamar initMap...");