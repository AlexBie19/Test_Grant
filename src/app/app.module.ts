import { NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";
import { CommonModule } from "@angular/common";
import { DxGanttModule } from "devextreme-angular";

import { AppComponent } from "./app.component";
import { Service } from "./app.service";

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, CommonModule, DxGanttModule],
  providers: [Service],
  bootstrap: [AppComponent],
})
export class AppModule {}
