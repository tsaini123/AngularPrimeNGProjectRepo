import { NestApplicationInterface } from '../nest/NestApplicationInterface';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import 'rxjs/add/operator/map';
import { DeviceModel } from '../../models/device';
import { NestCamEventModel } from '../../models/nestcam-event';
import { NotificationService } from '../notification-service/notification-service';
import gql from 'graphql-tag';
import { Apollo } from 'apollo-angular';

@Injectable()
export class DeviceService{

  private _devices$: BehaviorSubject<Array<DeviceModel>>;
 
  // Service consumers can subscribe to this observable to get latest device data.
  public devices$: Observable<Array<DeviceModel>>;
  
  // Local device cache.
  public _deviceStore: {
    devices: Array<DeviceModel>
  };

  constructor(private _nestAPI: NestApplicationInterface, private _notify: NotificationService, private apollo: Apollo) {

    this._deviceStore = { devices: new Array<DeviceModel>() };

    this._devices$ = new BehaviorSubject(new Array<DeviceModel>());

    this.devices$ = this._devices$.asObservable();

    this._InitiateNestAPI();

  }

  // Initiates retrieval of NEST devices.
  private _InitiateNestAPI() {

    this._nestAPI.setToken();
    this._nestAPI.streamServiceChanges();
    this._nestAPI.addHydratedListener();
    this._nestAPI.addUpdateListener();

    this._nestAPI.hydratedDevices$.subscribe(
      deviceCache => {

        if (deviceCache.devices) {
          this._LoadAllDevices(deviceCache);
        }

      });

  }

  // Load all hydrated devices.
  private _LoadAllDevices(hydratedDevices: any) {

    this._deviceStore.devices = this._MapDevices(hydratedDevices);
    this._devices$.next(this._deviceStore.devices);

  }

  // Maps raw JSON data to an array of DeviceModels.
  private _MapDevices(hydratedDevices: any): Array<DeviceModel> {

    var newDevices = new Array<DeviceModel>();

    if (hydratedDevices.devices.cameras) {

      for (let index in hydratedDevices.devices.cameras) {

        var nestCamera = hydratedDevices.devices.cameras[index];

        var model = new DeviceModel();

        model.id = nestCamera.device_id;
        model.name = nestCamera.name;
        model.snapshotURL = nestCamera.snapshot_url;
        model.appURL = nestCamera.app_url;
        model.webURL = nestCamera.web_url;
        model.isOnline = nestCamera.is_online;
        model.isStreaming = nestCamera.is_streaming;
        model.isAudioEnabled = nestCamera.is_audio_input_enabled;
        model.lastIsOnlineActivity = new Date(nestCamera.last_is_online_change);

        if (nestCamera.is_public_share_enabled && nestCamera.public_share_url) {

          model.liveFeedURL = this._ParseLiveFeedURL(nestCamera.public_share_url);
          model.embededIframe = this._GenerateEmbededIframe(model.webURL);

        }

        if (nestCamera.last_event) {

          model.LastEvent = new NestCamEventModel();
          model.LastEvent.startTime = new Date(nestCamera.last_event.start_time);
          model.LastEvent.endTime = new Date(nestCamera.last_event.end_time);
          model.LastEvent.hasMotion = nestCamera.last_event.has_motion;
          model.LastEvent.hasSound = nestCamera.last_event.has_sound;

        }

        newDevices.push(model);

      }

    }

    // Determine if new motion events had occured.
    newDevices = this._ParseDevicesForMotionEvents(this._deviceStore.devices, newDevices);

    return newDevices;
  }

  // Transforms live feed URL into a usable format.
  private _ParseLiveFeedURL(url: string): string {

    var parsedUrl: string = url;

    parsedUrl = parsedUrl + '?autoplay=1';

    return parsedUrl;

  }

  // Generates UI-friendly URL for camera embedding.
  private _GenerateEmbededIframe(url: string) {

    return '<iframe type="text/html" frameborder="0" width="1280" height="720" src="{{liveFeedURL}}" allowfullscreen></iframe>'.replace('{{liveFeedURL}}', url);

  }

  // Sets hasNewEvent property for new devices.
  private _ParseDevicesForMotionEvents(cachedDevices: Array<DeviceModel>, newDevices: Array<DeviceModel>): Array<DeviceModel> {

    for (var cachedDevice of cachedDevices) {

      for (var newDevice of newDevices) {

        if (cachedDevice.id === newDevice.id) {

          if (this._CameraHasNewMotionEvent(cachedDevice, newDevice)) {
            newDevice.hasNewEvent = true;
             this._LogMotionEvent(newDevice);
            
            // Commenting out until I figure out the cors issue.
            // this._notify.SendMotionNotification(newDevice);

          }

          break;
        }

      }

    }

    return newDevices;

  }

  // Determines if new motion events had occured.
  private _CameraHasNewMotionEvent(cachedDevice: DeviceModel, newDevice: DeviceModel): boolean {

    var hasNewMotionEvent: boolean = false;

    if (cachedDevice.LastEvent && newDevice.LastEvent && cachedDevice.LastEvent.startTime !== newDevice.LastEvent.startTime) {

      hasNewMotionEvent = true;

    }

    return hasNewMotionEvent;

  }

  private _LogMotionEvent(newDevice:DeviceModel): void{
    const cameraId = newDevice.id;
    const cameraName = newDevice.name;
    const imgURL = newDevice.snapshotURL;
    const image = btoa(imgURL);
    var eventDate = new Date();

    const createMotionEvent = gql`
    mutation createMotionEvent ($cameraId: String!, $cameraName: String!, $eventDate: DateTime!, $image: String!) {
      createMotionEvent(cameraId: $cameraId, cameraName: $cameraName, eventDate: $eventDate, image: $image) {
        id
      }
    }
  `;
 // alert(createMotionEvent);
  this.apollo.mutate({
    mutation: createMotionEvent,
    variables: {
      cameraId: cameraId,
      cameraName: cameraName,
      eventDate: new Date(),
      image: image
    }
  }).subscribe(({ data,loading }: any) =>{
    console.log('got data', data);
   // this.nestCamSnapshots = data.nestCamSnapshots;
 //   alert("in mutate subscribe method" + data);
    
  }, (error) => {
    console.log('there was an error sending the query', error);
  //  alert("in mutate error method:" + error);
  });
  
  
    //Ends.


  }

}

