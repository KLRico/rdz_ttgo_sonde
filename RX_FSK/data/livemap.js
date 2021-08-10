$(document).ready(function(){

  var map = L.map('map', { attributionControl: false });
  map.on('mousedown touchstart',function () { follow=false; });

  L.control.scale().addTo(map);
  L.control.attribution({prefix:false}).addTo(map);

  var osm = L.tileLayer('https://{s}.tile.openstreetmap.de/tiles/osmde/{z}/{x}/{y}.png', {
    attribution: '<div><a href="https://leafletjs.com/">Leaflet</a> &middot; Map: <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a></div>',
    minZoom: 1,
    maxZoom: 19
  });
  var esri = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: '<div><a href="https://leafletjs.com/">Leaflet</a> &middot; Map: <a href="https://www.esri.com/">Esri</a> &middot; Earthstar Geographics</div>',
    minZoom: 1,
    maxZoom: 20
  });

  var basemap = 'osm';
  osm.addTo(map);

  basemap_change = function () {
      if (basemap == 'osm') {
          map.removeLayer(osm);
          map.addLayer(esri);
          basemap = 'esri';
      } else {
          map.removeLayer(esri);
          map.addLayer(osm);
          basemap = 'osm';
      }
  };

  map.setView([51.163361,10.447683], 5); // Mitte DE

$('#map .leaflet-control-container').append(L.DomUtil.create('div', 'leaflet-top leaflet-center leaflet-header'));
var header = '';
header += '<div id="sonde_main"><b>rdzTTGOSonde LiveMap</b><br />🎈 <b><span id="sonde_id"></span> - <span id="sonde_freq"></span> MHz - <span id="sonde_type"></span></b></div>';
header += '<div id="sonde_detail"><span id="sonde_alt"></span>m | <span id="sonde_climb"></span>m/s | <span id="sonde_speed"></span>km/h</div>';
header += '<div id="sonde_status"><small><span id="sonde_statbar"></span></small></div>';
$('.leaflet-header').append(header);

$('#map .leaflet-control-container').append(L.DomUtil.create('div', 'leaflet-bottom leaflet-center leaflet-footer'));
var footer = '';
footer += '<div id="gps_main"><b>Direction: </b><span class="gps_dir">...</span>°<br /><b>Distance: </b><span class="gps_dist">...</span>m</div>';
$('.leaflet-footer').append(footer);

var statbar = '';
headtxt = function(data,stat) {
  var staticon = (stat == '1')?'🟢':'🟡';
  statbar = staticon + statbar;
  if ((statbar.length) > 20) { statbar = statbar.substring(0,20); }
  if (data.lat == '0.000000') { return false; }
  if (data.id) {
    $('#sonde_id').html(data.id);
    $('#sonde_alt').html(data.alt);
    $('#sonde_climb').html(data.climb);
    $('#sonde_speed').html( mr(data.speed * 3.6 * 10) / 10 );
    $('#sonde_detail').show();
  } else {
    $('#sonde_id').html(data.launchsite.trim());
    $('#sonde_detail').hide();
  }
  $('#sonde_freq').html(data.freq);
  $('#sonde_type').html(data.type);
  $('#sonde_statbar').html(statbar);
};

  map.addControl(new L.Control.Button([{ position: 'topleft', text: '🗺️', href: 'javascript:basemap_change();' }]));

  map.addControl(new L.Control.Button([
    { position: 'topright', id: "status", text: '🔴', href: 'javascript:get_data();' },
    { text: '⚙️', href: 'index.html' }
  ]));

  map.addControl(new L.Control.Button([
    { position:'topright', text: '🎈', href: 'javascript:show(marker,\'marker\');' },
    { text: '〰️', href: 'javascript:show_line();' },
    { text: '💥', href: 'javascript:show(marker_burst,\'burst\');' },
    { text: '🎯', href: 'javascript:show(marker_landing,\'landing\');' }
  ]));


  show = function(e,p) {
    if (p == 'landing') { get_predict(last_data); }
    if (e) {
      map.closePopup();
      map.setView(map._layers[e._leaflet_id].getLatLng());
      map._layers[e._leaflet_id].openPopup();
      follow = p;
    }
  };


  getTwoBounds = function (a,b) {
    var sW = new L.LatLng((a._southWest.lat > b._southWest.lat)?b._southWest.lat:a._southWest.lat, (a._southWest.lng > b._southWest.lng)?b._southWest.lng:a._southWest.lng);
    var nE = new L.LatLng((a._northEast.lat < b._northEast.lat)?b._northEast.lat:a._northEast.lat, (a._northEast.lng < b._northEast.lng)?b._northEast.lng:a._northEast.lng);

    return new L.LatLngBounds(sW, nE);
  };

  show_line = function() {
      $('.i_position, .i_landing').remove();
      map.closePopup();
      if (line._latlngs.length != 0 && line_predict._latlngs.length != 0) {
        map.fitBounds(getTwoBounds(line.getBounds(),line_predict.getBounds()));
      } else if (line._latlngs.length != 0) {
        map.fitBounds(line.getBounds());
      } else if (line_predict._latlngs.length != 0) {
        map.fitBounds(line_predict.getBounds());
      }
  };



  last_data = false;
  follow = 'marker';

  marker_landing = false;
  icon_landing = L.divIcon({className: 'leaflet-landing'});
  dots_predict = [];
  line_predict = L.polyline(dots_predict,{color: 'yellow'}).addTo(map);
  marker_burst = false;
  icon_burst = L.divIcon({className: 'leaflet-burst'});

  marker = false;
  dots = [];
  line = L.polyline(dots).addTo(map);

  draw = function(data) {
    var stat;
    if (data.id) {

      if ((data.lat != '0.000000' && data.lon != '0.000000') && (JSON.stringify(data) !=  JSON.stringify(last_data)) ) {
        var location = [data.lat,data.lon,data.alt];
        if (!marker) {
          map.setView(location, 14);
          marker = L.marker(location).addTo(map)
          .bindPopup(poptxt('position',data),{closeOnClick:false, autoPan:false}).openPopup();
          get_predict(data);
        } else {
          marker.slideTo(location, {
              duration: 500,
              keepAtCenter: (follow=='marker')?true:false
          })
          .setPopupContent(poptxt('position',data));
          if (last_data.id != data.id) {
            storage_remove();
            dots = [];
            get_predict(data);
          }
        }
        dots.push(location);
        line.setLatLngs(dots);
        storage_write(data);
        $('#status').html('🟢');
        stat = 1;
      } else {
        $('#status').html('🟡');
        stat = 0;
      }
      headtxt(data,stat);
      last_data = data;
    } else {
      $('#status').html('🟡');
      headtxt(data,0);
    }
  };


  marker_gps = false;
  icon_gps = L.divIcon({className: 'leaflet-gps'});
  circ_gps = false;

  gps = function(e) {
    gps_location = [e.lat/1000000,e.lon/1000000];
    gps_accuracy = e.hdop*2;

    if (last_data && last_data.lat != '0.000000') {
      if ($('.leaflet-footer').css('display') == 'none') { $('.leaflet-footer').show(); }

      var distance = Math.round(map.distance(gps_location,[last_data.lat, last_data.lon]));
      distance = (distance > 1000)?(distance / 1000) + 'k':distance;
      $('.leaflet-footer .gps_dist').html(distance);

      $('.leaflet-footer .gps_dir').html( bearing(gps_location,[last_data.lat, last_data.lon]) );
    }

    if (!marker_gps) {
      map.addControl(new L.Control.Button([{ position: 'topleft', text: '🛰️', href: 'javascript:show(marker_gps,\'gps\');' }]));

      marker_gps = L.marker(gps_location,{icon:icon_gps}).addTo(map)
      .bindPopup(poptxt('gps',e),{closeOnClick:false, autoPan:false});
      circ_gps = L.circle(gps_location, gps_accuracy).addTo(map);
    } else {
      marker_gps.slideTo(gps_location, {
          duration: 500,
          keepAtCenter: (follow=='gps')?true:false
      })
      .setPopupContent(poptxt('gps',e));
      circ_gps.slideTo(gps_location, { duration: 500 });
      circ_gps.setRadius(gps_accuracy);
    }
  };

  get_data = function() {
      $('#status').html('🔴');
      $.get('live.json', function( data ) {
        if (typeof data != "object") { data = $.parseJSON(data); }
        if (data.sonde) {
          draw(data.sonde);
        } else {
          setTimeout(function() {$('#status').html('🟡');},100);
        }
        if (data.gps) {
          gps(data.gps);
        }
      });
  };

  predictor = false;
  get_predict = function(data) {
    if (!data) { return; }
    var ascent = (data.climb > 0)? data.climb : 15;
    var descent = (data.climb > 0)? 5 : data.climb * -1;

    var burst;
    if (data.climb > 0) {
      burst = (data.alt > 32500)?data.alt + 500 : 32500;
    } else {
      burst = parseInt(data.alt) + 7;
      if (data.alt > 12000) { descent = 6; }
    }

    var m = new Date();
    var datetime = m.getUTCFullYear() + "-" + az(m.getUTCMonth()+1) + "-" + az(m.getUTCDate()) + "T" +
      az(m.getUTCHours()) + ":" + az(m.getUTCMinutes()) + ":" + az(m.getUTCSeconds()) + "Z";
    var url = 'https://predict.cusf.co.uk/api/v1/';
    url += '?launch_latitude='+data.lat + '&launch_longitude='+data.lon;
    url += '&launch_altitude='+data.alt + '&launch_datetime='+datetime;
    url += '&ascent_rate='+ascent + '&burst_altitude=' + burst + '&descent_rate='+descent;

    $.getJSON(url, function( prediction ) {
      draw_predict(prediction,data);
    });
  };

  draw_predict = function(prediction,data) {
    var ascending = prediction.prediction[0].trajectory;
    var highest = ascending[ascending.length-1];
    var highest_location = [highest.latitude,highest.longitude];

    var descending = prediction.prediction[1].trajectory;
    var landing = descending[descending.length-1];
    var landing_location = [landing.latitude,landing.longitude];

    if (!marker_landing) {
      marker_landing = L.marker(landing_location,{icon: icon_landing}).addTo(map)
      .bindPopup(poptxt('landing',landing),{closeOnClick:false, autoPan:false});
    } else {
      marker_landing.slideTo(landing_location, {
          duration: 500,
          keepAtCenter: (follow=='landing')?true:false
      })
      .setPopupContent(poptxt('landing',landing));
    }

    dots_predict=[];

    if (data.climb > 0) {
      ascending.forEach(p => dots_predict.push([p.latitude,p.longitude]));

      if (!marker_burst) {
        marker_burst = L.marker(highest_location,{icon:icon_burst}).addTo(map).bindPopup(poptxt('burst',highest),{closeOnClick:false, autoPan:false});
      } else {
        marker_burst.slideTo(highest_location, {
          duration: 500,
          keepAtCenter: (follow=='burst')?true:false
        }).setPopupContent(poptxt('burst',highest));
      }
    }

    descending.forEach(p => dots_predict.push([p.latitude,p.longitude]));
    line_predict.setLatLngs(dots_predict);

    if (data.climb > 0) {
      predictor_time =  5 * 60; // ascending, every 5 min
    } else if (data.climb < 0 && data.alt > 5000) {
      predictor_time =  2 * 60; // descending, above 5km, every 2 min
    } else {
      predictor_time =  30; // descending, below 5km, every 30 sec
    }
    clearTimeout(predictor);
    predictor = setTimeout(function() {get_predict(last_data);}, predictor_time*1000);
  };

  poptxt = function(t,i) {
    var lat_input = (i.id)?i.lat:i.latitude;
    var lon_input = (i.id)?i.lon:i.longitude;

    var lat = Math.round(lat_input * 1000000) / 1000000;
    var lon = Math.round(lon_input * 1000000) / 1000000;

    var add =
    '<br /><b>Position:</b> '+lat+',  '+lon+'<br />'+
    '<b>Open:</b> <a href="https://www.google.de/maps/?q='+lat+', '+lon+'" target="_blank">GMaps</a> | <a href="https://www.openstreetmap.org/?mlat='+lat+'&mlon='+lon+'&zoom=15" target="_blank">OSM</a> | <a href="mapsme://map?ll='+lat+','+lon+'">Maps.me</a>';

    if (t == 'position') { return '<div class="i_position"><b>🎈 '+i.id+'</b>'+add+'</div>'; }
    if (t == 'burst') { return '<div class="i_burst"><b>💥 Predicted Burst:</b><br />'+fd(i.datetime)+' in '+mr(i.altitude)+'m'+add+'</div>'; }
    if (t == 'highest') { return '<div class="i_burst"><b>💥 Burst:</b> '+mr(i.altitude)+'m'+add+'</div>';}
    if (t == 'landing') { return '<div class="i_landing"><b>🎯 Predicted Landing:</b><br />'+fd(i.datetime)+' at '+mr(i.altitude)+'m'+add+'</div>'; }
    if (t == 'gps') { return '<div class="i_gps">Position: '+(i.lat/1000000)+','+(i.lon/1000000)+'<br />Altitude: '+mr(i.alt/1000)+'m<br />Speed: '+mr(i.speed/1000 * 1.852 * 10)/10+'km/h '+mr(i.dir/1000)+'°<br />Sat: '+i.sat+' Hdop:'+(i.hdop/10)+'</div>'; }
  };

  fd = function(date) {
    var d = new Date(Date.parse(date));
    return az(d.getUTCHours()) +':'+ az(d.getUTCMinutes())+' UTC';
  };
  az = function(n) { return (n<10)?'0'+n:n; };
  mr = function(n) { return Math.round(n); };

  storage = (typeof(Storage) !== "undefined")?true:false;
  storage_write = function (data) {
    if (storage) {
      if (sessionStorage.sonde) {
        storage_data = JSON.parse(sessionStorage.sonde);
      } else {
        storage_data = [];
      }
      if (JSON.stringify(data) !=  JSON.stringify(storage_data[storage_data.length - 1])) {
        storage_data.push(data);
        sessionStorage.sonde = JSON.stringify(storage_data);
      }
    }
  };

  storage_read = function() {
    if (storage) {
      if (sessionStorage.sonde) {
        storage_data = JSON.parse(sessionStorage.sonde);
        return storage_data;
      }
    }
    return false;
  };

  storage_remove = function() {
    sessionStorage.removeItem('sonde');
  };

  session_storage = storage_read();
  if (session_storage) {
    session_storage.forEach(function(d) {
      dots.push([d.lat,d.lon,d.alt]);
      session_storage_last = d;
    });
    draw(session_storage_last);
  }

  setInterval(get_data,1000);

});

L.Control.Button = L.Control.extend({
  onAdd: function (map) {
    var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
    options = this.options;
    Object.keys(options).forEach(function(key) {
      this.link = L.DomUtil.create('a', '', container);
      this.link.text = options[key].text;
      this.link.href = options[key].href;
      this.link.id =  options[key].id;
    });

    this.options.position = this.options[0].position;
    return container;
  }
});


// https://github.com/makinacorpus/Leaflet.GeometryUtil/blob/master/src/leaflet.geometryutil.js#L682
// modified to fit
function bearing(latlng1, latlng2) {
    var rad = Math.PI / 180,
        lat1 = latlng1[0] * rad,
        lat2 = latlng2[0] * rad,
        lon1 = latlng1[1] * rad,
        lon2 = latlng2[1] * rad,
        y = Math.sin(lon2 - lon1) * Math.cos(lat2),
        x = Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
    var bearing = ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
    bearing = bearing < 0 ? bearing-360 : bearing;
    return Math.round(bearing);
}