/*
 * TODO:
 * // Job UI & Logics
 * 1. Connect FeatureServer to map
 * 2. Connect Related Table as Feature Layer
 * 3. Relate Table with Selected Record by 'ROW_CODE'
 * 4. For FeatureLayer ApplyEdit
 * 
 * // Configuration UI & Logics
 * 1. Extract configuration viables
 * 2. Create template for the Configuation UI
 * 3. Plant the vairables
 * 4. Pass Map and layerInfos from Configuration to the widget
 *
 * // App MetaData Setups 
 * 1. App Manifest.js setup
 * 2. App deployment
*/
define(['dojo/_base/declare', 
			'jimu/BaseWidget',

			'dijit/_WidgetsInTemplateMixin',
			'dijit/registry',

			'dojo/_base/array',
			'dojo/has',
			'dojo/on',
			'dojo/dom',
			'dojo/dom-class',
			'dojo/dom-construct',
			'dojo/_base/lang',
			'dojo/query',

			'esri/tasks/query',
			'esri/tasks/QueryTask',
			'esri/tasks/RelationshipQuery',
			'esri/layers/FeatureLayer',
			'esri/graphic',

			'./lib/dgrid/Keyboard',
			'./lib/dgrid/Selection',
			'./lib/dgrid/Editor',
			'./lib/dgrid/Grid',
			'./lib/dgrid/extensions/ColumnResizer',

			'dojo/domReady!'
		],
	function(declare, 
		BaseWidget,
		
		_WidgetsInTemplateMixin,
		registry,

		array,
		has,
		on,
		dom,
		domClass,
		domConstruct,
		lang,
		query,

		Query,
		QueryTask,
		RelationshipQuery,
		FeatureLayer,
		Graphic,

		Keyboard,
		Selection,
		Editor,
		Grid,
		ColumnResizer) {
		//To create a widget, you need to derive from BaseWidget.
		return declare([BaseWidget, _WidgetsInTemplateMixin], {
			// Custom widget code goes here

			baseClass: 'jimu-widget-relatetable',

			//this property is set by the framework when widget is loaded.
			//name: 'CustomWidget',

			// Properties:
			selectedLayer: null,
			// selectedField: null,
			selectedRelationship: null,
			relatedFeatureLayers: [],
			editGrid: null,
			updatedFeatures: [],
			featuresCopy: null,

			relationshipFields: null,
			keyField: null,
			keyFieldValue: null,
			relatedTableLayer: null,
			lastMouseEvent: null,

			//methods to communication with app container:

			postCreate: function() {
				this.inherited(arguments);
				console.log('postCreate');

			  /* Inject Widget Stylesheet */
				var link = document.createElement('link');
				link.href = require.toUrl('widgets/RelateTable/lib/dgrid/css/dgrid.css');
				link.rel = 'stylesheet';
				link.type = 'text/css';
				var head = document.getElementsByTagName('head')[0];
				var links = head.getElementsByTagName('link');
				var isLoaded = false;
				array.forEach(links, function(entry) {
					if (entry.href.indexOf(link.href) > -1 ){
						isLoaded = true;
					}
				});
				if (isLoaded) return;
				head.insertBefore(link, links[links.length - 1]);
			},

			startup: function() {
				this.inherited(arguments);
				console.log(this.map);
				console.log('Config', this.config);
				console.log('startup');

				this._initLayerSelector(this.map);

				this.editGrid = new (declare([ Grid, Keyboard, Selection, Editor, ColumnResizer ]))({
				}, 'editGrid');

				on(this.editGrid, 'dgrid-datachange', lang.hitch(this, this._updateGridModel));

				on(this.selectFeatureNode, 'click', lang.hitch(this, function() {
					this._toggleClassChange();
					this._gatherSelectInfo();
				}));

				if(!!this.selectedLayer) {
					on(this.selectedLayer, 'click', lang.hitch(this, function(event) {
						this.lastMouseEvent = event;
						this._findRelate(event);
					}));
				}				

				on(this.saveNode, 'click', lang.hitch(this, this._saveEdits));
				on(this.cancelNode, 'click', lang.hitch(this, this._cancelEdits));

				on(this.selectLayerNode, 'change', lang.hitch(this, this._disableSelect));
				on(this.selectRelationshipNode, 'change', lang.hitch(this, this._disableSelect));

				on(this.addFeatureNode, 'click', lang.hitch(this, this._showAddFeatureDialog));
				on(this.addRecordNode, 'click', lang.hitch(this, this._saveAddedRecord));
				on(this.cancelRecordNode, 'click', lang.hitch(this, this._cancelAddedRecord));
			},

			// onOpen: function(){
			//   console.log('onOpen');
			// },

			// onClose: function(){
			//   console.log('onClose');
			// },

			// onMinimize: function(){
			//   console.log('onMinimize');
			// },

			// onMaximize: function(){
			//   console.log('onMaximize');
			// },

			// onSignIn: function(credential){
			//   /* jshint unused:false*/
			//   console.log('onSignIn');
			// },

			// onSignOut: function(){
			//   console.log('onSignOut');
			// }

			// onPositionChange: function(){
			//   console.log('onPositionChange');
			// },

			// resize: function(){
			//   console.log('resize');
			// }

			//methods to communication between widgets:

			_toggleClassChange: function() {
				// Class changing.
				if(domClass.contains(this.selectFeatureNode, 'toggle-on')){
					// if user turns it off
					domClass.remove(this.selectFeatureNode, 'toggle-on');
					domClass.add(this.selectFeatureNode, 'grey');
					this.selectFeatureNode.innerHTML = '<span>Select Off</span>';
				} else { // if user turns it on 
					domClass.add(this.selectFeatureNode, 'toggle-on');
					domClass.remove(this.selectFeatureNode, 'grey');
					this.selectFeatureNode.innerHTML = '<span>Select On</span>';
				}
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

					if (layers.length === 0) return;

					array.forEach(layers, function(entry) {
						var isSelected = (entry.title.toLowerCase() === me.config.defaultSpatialLayer.toLowerCase()) ? 'selected ' : '';
						var optionNode = '<option ' + isSelected + 'value=' + entry.id + '>' + entry.title + '</option>';
						domConstruct.place(optionNode, 'selectLayerNode', 'last');
					});

					this.selectedLayer = layers[0].layerObject;

					this._setRelationshipSelector(this.selectedLayer);

					this._initRelatedFeatureLayers(map);

					on(this.selectLayerNode, 'change', lang.hitch(this, function() {
						this._updateRelationshipSelector(layers);
					}));
				} catch(err) {

				}
			},

			_setRelationshipSelector: function(layer) {
				var me = this;
				// clear the <select>
				this.selectRelationshipNode.innerHTML = '';

				var relationships = layer.relationships;

				array.forEach(relationships, function(relationship) {
					var isSelected = (relationship.name.toLowerCase() === me.config.defaultRelationship.toLowerCase()) ? 'selected ' : '';
					var optionNode = '<option ' + isSelected + 'value=' + relationship.id+ '>' + relationship.name + '</option>';
					if (isSelected === 'selected') console.log(relationship, optionNode);
					domConstruct.place(optionNode, 'selectRelationshipNode', 'last');
				});
			},

			_initRelatedFeatureLayers: function(map) {
				var me = this;
				var tables = map.itemInfo.itemData.tables;
				tables.forEach(function(entry) {
					var featureLayer = new FeatureLayer(entry.url);
					me.relatedFeatureLayers.push(featureLayer);
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
			},

			_gatherSelectInfo: function() {
				var me = this;

				// Get relationship id
				var relationshipOptions = this.selectRelationshipNode.options;
				this.selectedRelationship = relationshipOptions[relationshipOptions.selectedIndex].value;

				// console.log(this.selectedLayer, this.selectedRelationship);
			},

			_findRelate: function(event) {
				console.log(event);
				this._getFields(event.graphic.attributes);
				if(domClass.contains(this.selectFeatureNode, 'toggle-on')) {

					this._clearGrid();

					var oid = event.graphic.attributes.OBJECTID;
					var relatedQuery = new RelationshipQuery();
					relatedQuery.outFields = ["*"];
					relatedQuery.relationshipId = this.selectedRelationship;
					relatedQuery.objectIds = [oid];
					this.selectedLayer.queryRelatedFeatures(relatedQuery, lang.hitch(this, function(relatedFeatures) {
							if (!this._isEmpty(relatedFeatures)) {
								this._findRelateSuccess(relatedFeatures[oid].features);
							}
						}), lang.hitch(this, this._findRelateFail));
				}
			},

			_findRelateSuccess: function(features) {
				console.log(features);
				var me = this;

				// Convert features to dgrid format
				var relatedData = features
					.map(function(feature) {
						return feature.attributes;
					});

				// make a copy of original data for cancel editing and add feature.
				this.featuresCopy = dojo.clone(relatedData);

				// Continue formatting...
				var columns = [];
				for(var key in relatedData[0]) {
					if (relatedData[0].hasOwnProperty(key)){
						// skip "OID" and "GlobalID"
						if (key !== "OBJECTID" && key !== "GlobalID") {
							columns.push({
								field: key,
								editor: 'text',
								editOn: has('touch') ? 'click' : 'dblclick',
								autoSave: false
							});
						}
					}
				}
				this.editGrid.set('columns', columns);
				this.editGrid.renderArray(relatedData);

				// TODO: Fix table header refreshing issue
				// Currently found clicking header cell will
				// help to temporarily solve the issue.
				this._refreshGrid();

			},

			_findRelateFail: function(err) {
				console.error(err);
			},

			_saveEdits: function() {
				console.log('save edits.');
				var me = this;
				if (this.updatedFeatures.length > 0) {
					console.log(this.selectedRelationship);
					var featureLayer = this.relatedFeatureLayers.filter(function(layer) { 
							var relationship = me.selectedLayer.relationships.filter(function(relationship) {
								return relationship.id === +me.selectedRelationship;
							}).reduce(function(prev) { return prev; });
							return new RegExp(relationship.name).test(layer.name);
						}).reduce(function(prev) { return prev; });
					var targetGraphics =  this.updatedFeatures.map(function(attributes) {
						return new Graphic(null, null, attributes);
					});
					featureLayer.applyEdits(null, targetGraphics, null, function(res){
						// Success to save
						me.updatedFeatures.forEach(function(attributes) {
							me.featuresCopy = me.featuresCopy.map(function(feature) {
								if (feature.OBJECTID === attributes.OBJECTID) {
									feature = attributes;
								}
								return feature;
							});
						});
						me.updatedFeatures = [];
						me._showAlert(true);
						console.log('save succeeded.');
					}, function(err){
						// Fail to save
						me._showAlert(false);
						console.log(err);
					});
				}
			},

			_cancelEdits: function() {
				console.log('cancel edits.');
				console.log('later copy', this.featuresCopy);
				if (this.updatedFeatures.length > 0) {
					this.editGrid.renderArray(this.featuresCopy);
					this._refreshGrid();
					this.featuresCopy = dojo.clone(this.featuresCopy);
					this.updatedFeatures = [];
				}
			},

			_updateGridModel: function(event) {
				// console.log(event);
				// console.log('cell', event.cell);
				console.log('old value', event.oldValue);
				console.log('new value', event.value);
				console.log('autosave value', this.featuresCopy);

				this._updateCollection(this.updatedFeatures, event.cell.row.data);

			},

			_updateCollection: function(collection, item) {
				if (collection.length == 0) {
					collection.push(item);
				}
				collection.forEach(function(entry){
					if (entry.OBJECTID === item.OBJECTID) {
						entry = item;
					} else {
						collection.push(item);
					}
				});
			},

			_refreshGrid: function(){
				var firstCell = query('.jimu-widget-relatetable th.dgrid-cell:nth-child(1)')[0];
				on.emit(firstCell, "click", {
					bubbles: true,
					cancelable: true
				});
			},

			_disableSelect: function () {
				if(domClass.contains(this.selectFeatureNode, 'toggle-on')){
					domClass.remove(this.selectFeatureNode, 'toggle-on');
					domClass.add(this.selectFeatureNode, 'grey');
					this.selectFeatureNode.innerHTML = '<span>Select Off</span>';
				}
				this._clearGrid();
			},

			_isEmpty: function (obj) {
				for (var key in obj) {
					if (obj.hasOwnProperty(key)){
						return false;
					}
				}
				return true;
			},

			_clearGrid: function(){
				try{
					this.editGrid.renderArray([]);
					this._refreshGrid();	
				}catch(err){}
				
			},

			_showAlert: function(isSuccessfull) {
				var me = this;
				if (isSuccessfull) {
					this.successNode.style.display = 'block';
					this.failNode.style.display = 'none';
				} else {
					this.successNode.style.display = 'none';
					this.failNode.style.display = 'block';
				}
				domClass.remove(this.alertNode, 'hide');

				setTimeout(function(){ 
					domClass.add(me.alertNode, 'hide');
				}, 3000);
			},

			_getFields: function(selectedFeatureAttributes) {
				this.relatedTableLayer = this.relatedFeatureLayers[this.selectRelationshipNode.options.selectedIndex];

				this.relationshipFields = this.relatedTableLayer.fields;

				this.keyField = this.map.itemInfo.itemData.operationalLayers[this.selectLayerNode.options.selectedIndex].layerObject.relationships[this.selectRelationshipNode.options.selectedIndex].keyField;

				this.keyFieldValue = selectedFeatureAttributes[this.keyField];
			},

			_showAddFeatureDialog: function() {
				var self = this;

				console.log('relationshipFields', this.relationshipFields);
				console.log('keyField', this.keyField);
				console.log('keyFieldValue', this.keyFieldValue);

				var lines = '';
				this.relationshipFields.forEach(function(field) {
					// skip "OID" and "GlobalID"
					if (field.name !== "OBJECTID" && field.name !== "GlobalID") {
						if (field.name === self.keyField) {
							var line = '<tr style="width: calc(100% - 10px); padding: 5px;"><td style="width: 200px;"><label for="' + field.name + '" title="' + field.name + '">' + field.alias + '</label></td><td><input id="' + field.name + '" name="' + field.name + '" value="' + self.keyFieldValue + '"><td></tr>';
						} else {
							var line = '<tr style="width: calc(100% - 10px); padding: 5px;"><td style="width: 200px;"><label for="' + field.name + '" title="' + field.name + '">' + field.alias + '</label></td><td><input id="' + field.name + '" name="' + field.name + '"></td></tr>';
						}
						
						lines += line;
					}
				})
				var table =  '<table id="dialogTable">' + lines + '</table>';
				var tableWidget = declare('tableWidget', [BaseWidget, _WidgetsInTemplateMixin], {
					templateString: table
				});

				this.dialogInput.innerHTML = table;
				
				this.dialog.show();
			},

			_saveAddedRecord: function() {
				var self = this;
				var attributes = {};
				query('#dialogTable input').forEach(function(node) {
					attributes[node.name] = node.value;
				});
				console.log(attributes)

				var targetGraphics =  [new Graphic(null, null, attributes)];

				this.relatedTableLayer.applyEdits(targetGraphics, null, null, function(res){
					// Success to save
					registry.byId('dialog').hide();
					self._findRelate(self.lastMouseEvent);
					self._showAlert(true);
					console.log('save succeeded.');
				}, function(err){
					// Fail to save
					self._showAlert(false);
					console.log(err);
				});
			},

			_cancelAddedRecord: function() {
				registry.byId('dialog').hide();
			}

		});
	});