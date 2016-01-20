define([
    'dojo/_base/declare',
    'jimu/BaseWidgetSetting',

    'dojo/on',
    'dojo/dom-construct',
    'dojo/_base/lang'
  ],
  function(
    declare,
    BaseWidgetSetting,

    on,
    domConstruct,
    lang) {
    return declare([BaseWidgetSetting], {

      baseClass: 'jimu-widget-relatetable-setting',

      startup: function() {
        this.inherited(arguments);
        console.log('config', this.config);
        console.log('map', this.map);
        this.setConfig(this.config);
      },

      setConfig: function(config) {
        this.config = config;
        this._initLayerSelector(this.map);
      },

      getConfig: function() {
        this.config.defaultSpatialLayer = this.selectLayerNode.value;
        this.config.defaultRelationship = this.selectRelationshipNode.value;
        return this.config;
      },

      _initLayerSelector: function(map) {
        var me = this;
        try {
          var layers = map.itemInfo.itemData.operationalLayers
            .filter(function(layer) {
              if (layer.layerObject && layer.layerObject.relationships) {
                return layer.layerObject.relationships.length > 0;
              } else {
                return false;
              }
            });
          if (layers.length === 0) {
            this.selectorsNode.style.visibility = 'hidden';
            this.warningNode.style.display = 'block';
            return;
          }
          layers.forEach(function(entry) {
            var isSelected = (entry.title.toLowerCase() === me.config.defaultSpatialLayer.toLowerCase()) ? 'selected ' : '';
            var optionNode = '<option ' + isSelected + 'value=' + entry.id + '>' + entry.title + '</option>';
            domConstruct.place(optionNode, 'selectLayerNode', 'last');
          });

          this.selectedLayer = layers[0].layerObject;
          this._setRelationshipSelector(this.selectedLayer);

          on(this.selectLayerNode, 'change', lang.hitch(this, function() {
            this._updateRelationshipSelector(layers);
          }));
        } catch (err) {
          console.warn(err);
        }
        
      },

      _setRelationshipSelector: function(layer) {
        var me = this;
        // clear the <select>
        this.selectRelationshipNode.innerHTML = '';

        var relationships = layer.relationships;

        relationships.forEach(function(relationship) {
          var isSelected = (relationship.name.toLowerCase() === me.config.defaultRelationship.toLowerCase()) ? 'selected ' : '';
          var optionNode = '<option ' + isSelected + 'value=' + relationship.id+ '>' + relationship.name + '</option>';
          if (isSelected === 'selected') console.log(relationship, optionNode);
          domConstruct.place(optionNode, 'selectRelationshipNode', 'last');
        });
      },

      _updateRelationshipSelector: function(layers) {
        var me = this;
        var options = this.selectLayerNode.options;
        var id = options[options.selectedIndex].value;
        layers.forEach(function(entry) {
          if (entry.id == id) {
            me.selectedLayer = entry.layerObject;
            me._setRelationshipSelector(me.selectedLayer);
          }
        });
      }

    });
  });