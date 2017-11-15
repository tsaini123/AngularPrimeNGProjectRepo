import { DeviceService } from '../providers/device-service/device-service';
import { Component, OnInit, ViewChild } from '@angular/core';
import { Observable } from "rxjs";
import { Apollo } from 'apollo-angular';
import gql from 'graphql-tag';

@Component({
  selector: 'at-nestcam',
  templateUrl: './nestcam.component.html'
})
export class NestcamComponent implements OnInit {

  isStreaming: boolean;
  cameraName: string;
  nestCamSnapshots = [];

  constructor(private apollo: Apollo, private _deviceService: DeviceService) {

    // Subscribe to devices$ Observable.
    this._deviceService.devices$.subscribe(devices => {

      const nestcams = devices;

    });

  }

  ngOnInit() {
    this.isStreaming ;
    this.cameraName ;

    //alert("onInit");
    const AllNestCamSnapshotsQuery = gql`
    query allMotionEvents{
      allMotionEvents(orderBy: eventDate_DESC first:5) {
          cameraName
          eventDate       
          image             
           
        }      
    }`;

    const queryObservableFirst = this.apollo.watchQuery({

      query: AllNestCamSnapshotsQuery,
      pollInterval:10

    }).subscribe(({ data, loading }: any) => {
      var index= 0;
      var arr = [];

      
      data.allMotionEvents.forEach(element => {
        var localDate = (new Date(element.eventDate)).toLocaleString();
        try{
          let newObj = {
            id:element.id,
            cameraId:element.cameraId,
            cameraName:element.cameraName,
            image:atob(element.image),
            eventDate:localDate
         };
         arr.push(newObj);
        //  this.nestCamSnapshots[index].image = atob(element.image);
        }
        catch(error){
        //  alert(error);
        }
        index++;
      });
     // alert("img:" + data.allMotionEvents[0].image);
     this.nestCamSnapshots = arr;
      
    }, (error) => {
      console.log('there was an error sending the query', error);
      alert("in init error:" + error);
    }); 

    const AllNestCams = gql`
    query allNestCams {
      allNestCams {
          id
          name
          isStreaming
        }
    }`;

    const queryObservable = this.apollo.watchQuery({

      query: AllNestCams,
      pollInterval: 500

    }).subscribe(({ data, loading }: any) => {

      this.isStreaming = data.allNestCams[0].isStreaming;

      if (this.isStreaming) {

        this.cameraName = data.allNestCams[0].name;

      } else {

        this.cameraName = 'Offline';

      }

    });

  }

}
