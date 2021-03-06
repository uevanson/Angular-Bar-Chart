
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import {
  FetchDataService,
  HistoricData,
  RawHistoricData
} from '../fetch-data/fetch-data.service';
import * as d3 from 'd3';
import { AxisDomain } from 'd3';
import { Subscription } from 'rxjs';

@Component({
  selector: 'bar-chart',
  templateUrl: './bar-chart.component.html',
  styleUrls: ['./bar-chart.component.css'],
  host: { '(window: resize)': 'onResize($event)' }
})
export class BarChartComponent implements OnInit, AfterViewInit, OnDestroy {

  private dataSubscription: Subscription;
  @ViewChild('barChart', { static: true }) barChart?: ElementRef;
  private bars: d3.Selection<SVGRectElement, RawHistoricData, SVGElement, unknown> | undefined;
  private clipPath: d3.Selection<any, unknown, null, undefined> | undefined;
  private candleFill: string = "green";
  private data: RawHistoricData[] | undefined;
  private filteredData: HistoricData[] | undefined;
  public filterDate: number | undefined;
  private extent: [[number, number], [number, number]] | undefined
  private margin: { top: number, bottom: number, left: number; right: number } = { top: 10, bottom: 40, left: 30, right: 80 };
  private dateFormat: string = "%Y-%m-%d";
  private onInint: boolean = true;
  private xMin?: Date | undefined;
  private xMax?: Date | undefined;
  private xRange: [number, number] | undefined;
  private xDomain: Date[] | undefined;
  private xFormat: string = "%b %-d";
  private xScale: d3.ScaleBand<Date> | undefined;
  private xTicks: Date[] | undefined;
  private xAxis: d3.Axis<d3.AxisDomain> | undefined;
  private xPadding: number = 0.2;
  private yMax?: number | undefined;
  public yScale: d3.ScaleLinear<number, number, never>;
  private yAxis: d3.Axis<AxisDomain> | undefined;
  public dates: Date[] | undefined;
  private svg?: d3.Selection<any, unknown, null, undefined> | undefined;
  private stems: d3.Selection<SVGLineElement, RawHistoricData, SVGElement, unknown> | undefined;
  private transitionDuration: number = 300;
  private defaultWidth: number = 1000;
  private defaultHeight: number = 900;
  private zoom: d3.ZoomBehavior<Element, unknown> | undefined;

  constructor(
    private _fetchDataService: FetchDataService
  ) {
  }



  ngOnInit(): void {

  }

  ngAfterViewInit(): void {
    this.svg = d3.select(this.barChart?.nativeElement);
    this.setElementDimensions(window.innerHeight, window.innerWidth);
    this.dataSubscription = this._fetchDataService._teslaHistoricDataSource.subscribe(data => {
      this.data = data;
      var dateFormat = d3.utcParse(this.dateFormat);
      for (var i = 0; i < this.data.length; i++) {
        var dateString = this.data[i].date;
        this.data[i].date = dateFormat(dateString);
      }
      this.drawChart(this.data, this.onInint);
    })
  }


  ngOnDestroy(): void {
    this.dataSubscription.unsubscribe();
  }

  public onResize(event: any): void {
    this.setElementDimensions(window.innerHeight, window.innerWidth);
    this.resizeChart();
  }

  private innerWidth(defaultWidth: number): number {
    if (this.barChart) {
      return this.barChart.nativeElement.clientWidth - this.margin.left - this.margin.right;
    } else {
      return defaultWidth;
    }
  }

  private innerHeight(defaultHeight: number): number {
    if (this.barChart) {
      return this.barChart.nativeElement.clientHeight - this.margin.top - this.margin.bottom;
    } else {
      return defaultHeight;
    }
  }

  private setElementDimensions(windowHeight: number, windowWidth: number): void {
    var rect: DOMRect = this.barChart.nativeElement.getBoundingClientRect();
    let setHeight: number = windowHeight - rect.top;
    let setWidth: number = windowWidth - rect.left;
    this.barChart.nativeElement.style.height = setHeight + 'px';
    this.barChart.nativeElement.style.width = setWidth + 'px';
  }

  private setMaxValue(data: HistoricData[], property: string): any {
    return d3.max(data.map(r => r[property]));
  }

  private setMinValue(data: HistoricData[], property: string): any {
    return d3.min(data.map(r => r[property]));
  }

  private drawChart(data: RawHistoricData[], init: boolean): void {

    this.xMin = this.setMinValue(data, "date");
    this.xMax = this.setMaxValue(data, "date");
    this.xRange = [0, this.innerWidth(this.defaultWidth)];
    this.xDomain = this.weekdaysScale(this.xMin, this.xMax, 1);
    this.xScale = d3.scaleBand(this.xDomain, this.xRange).paddingInner(this.xPadding).align(0.5);
    this.xTicks = this.weeksScale(d3.min(this.xDomain), d3.max(this.xDomain), 2, 0);
    this.xAxis = d3.axisBottom(this.xScale).tickFormat(d3.utcFormat(this.xFormat)).tickValues(this.xTicks);
    var maxP: number = +this.setMaxValue(data, "volume");
    var buffer = maxP * 0.1;
    this.yMax = maxP + buffer;
    this.filteredData = data;
    this.yScale = d3.scaleLinear().domain([0, this.yMax]).range([this.innerHeight(this.defaultHeight), 0]).nice();
    this.yMax = this.yScale.domain()[1];
    this.yAxis = d3.axisRight(this.yScale).tickFormat(d3.format(",.0f"));

    data[data.length - 1].date = new Date(data[data.length - 1].date.setDate(data[data.length - 1].date.getDate() - 1)) // random hack required
    if (!init) {
      this.svg.select<SVGGElement>('#xAxis')
        .transition()
        .duration(this.transitionDuration)
        .delay(this.transitionDuration)
        .attr('transform', `translate(${this.margin.left},${this.innerHeight(this.defaultHeight) + this.margin.top})`)
        .call(d3.axisBottom(this.xScale).tickFormat(d3.utcFormat(this.xFormat)).tickValues(this.xTicks))
        .selectAll("path, line")
        .attr("stroke", 'azure');

      this.svg.select<SVGGElement>('#yAxis')
        .transition()
        .duration(this.transitionDuration)
        .delay(this.transitionDuration)
        .attr('transform', `translate(${this.innerWidth(this.defaultWidth) + this.margin.left}, ${this.margin.top})`)
        .call(d3.axisRight(this.yScale).tickFormat(d3.format(",.0f")))
        .selectAll("path, line")
        .attr("stroke", 'azure')

      this.svg.selectAll("text").transition()
        .duration(this.transitionDuration)
        .delay(this.transitionDuration)
        .attr("fill", 'azure')

    } else {
      this.svg.append("rect")
        .attr("id", "rect")
        .attr("width", this.innerWidth(this.defaultWidth))
        .attr("height", this.innerHeight(this.defaultHeight))
        .attr("transform", `translate(${this.margin.left}, ${this.margin.top})`)
        .style("fill", "none")
        .style("pointer-events", "all")
        .attr("clip-path", "url(#clip)");

      this.svg.append("g")
        .attr("id", "xAxis")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(${this.margin.left}, ${this.innerHeight(this.defaultHeight) + this.margin.top})`)
        .call(this.xAxis);

      this.svg.append("g")
        .attr("id", "yAxis")
        .attr("class", "axis y-axis")
        .attr("transform", `translate(${this.innerWidth(this.defaultWidth) + this.margin.left}, ${this.margin.top})`)
        .call(this.yAxis);

      this.clipPath = this.svg.append("g")
        .attr("class", "chartBody")
        .attr("clip-path", "url(#clip)");
    }


    this.clipPath.selectAll(".bar")
      .data(data)
      .join(
        enter =>
          enter
            .append("rect")
            .attr('x', (d: RawHistoricData) => { return this.margin.left + this.xScale(d.date) })
            .attr("class", "bar")
            .attr('y', (d: RawHistoricData) => { return this.yScale(d.volume) })
            .attr('width', this.xScale.bandwidth())
            .attr('height', (d: RawHistoricData) => { return this.innerHeight(this.defaultHeight) - this.yScale(d.volume) })
            .attr("fill", (d: RawHistoricData) => { return (d.open === d.close) ? "silver" : (d.open > d.close) ? "red" : this.candleFill })
            .attr("stroke", (d: RawHistoricData) => { return (d.open === d.close) ? "silver" : (d.open > d.close) ? "red" : "green" })
        ,
        update =>
          update
            .attr('x', (d: RawHistoricData) => { return this.margin.left + this.xScale(d.date) })
            .attr('y', (d: RawHistoricData) => { return this.yScale(d.volume) })
            .attr('width', this.xScale.bandwidth())
            .attr('height', (d: RawHistoricData) => { return this.innerHeight(this.defaultHeight) - this.yScale(d.volume) })
            .attr("fill", (d: RawHistoricData) => (d.open === d.close) ? "silver" : (d.open > d.close) ? "red" : this.candleFill)
            .attr("stroke", (d: RawHistoricData) => (d.open === d.close) ? "silver" : (d.open > d.close) ? "red" : "green")
        ,
        exit =>
          exit
            .attr("height", 0)
            .attr("opacity", 0)
            .transition()
            .duration(this.transitionDuration)
            .remove()
      )

    this.svg.append("defs")
      .append("clipPath")
      .attr("id", "clip")
      .append("rect")
      .attr("width", this.innerWidth(this.defaultWidth))
      .attr("height", this.innerHeight(this.defaultHeight))
      .attr("transform", `translate(${this.margin.left}, ${this.margin.top})`);

    this.extent = [[0, 0], [this.innerWidth(this.defaultWidth), this.innerHeight(this.defaultHeight)]];
    this.zoom = d3.zoom()
      .scaleExtent([1, 100])
      .translateExtent(this.extent)
      .extent(this.extent)
      .on('zoom', (event) => this.zoomed(event))
    this.svg.call(this.zoom)

  }

  private weeksScale(start: Date, stop: Date, stride: number, addDays: number): Date[] {
    return d3.utcMonday.every(stride).range(start, new Date(stop.setDate(stop.getDate() + addDays)));
  }
  private weekdaysScale(start: Date, stop: Date, addDays: number): Date[] {
    return d3.utcDays(start, new Date(stop.setDate(stop.getDate() + addDays)), 1).filter(d => d.getUTCDay() !== 0 && d.getUTCDay() !== 6);
  }

  private zoomed(event): void {
    this.xScale = this.xScale.range([this.margin.left, this.innerWidth(this.defaultWidth)].map(d => event.transform.applyX(d))).align(0.5);
    this.xAxis = d3.axisBottom(this.xScale).tickFormat(d3.utcFormat(this.xFormat)).tickValues(this.xTicks);
    this.bars = this.clipPath.selectAll(".bar");
    this.bars
      .transition().ease(d3.easePolyInOut).duration(this.transitionDuration)
      .attr("x", (d: RawHistoricData) => { return this.margin.left + this.xScale(d.date) })
      .attr("width", this.xScale.bandwidth())
      .attr('y', (d: RawHistoricData) => { return this.yScale(d.volume) })
      .attr('height', (d: RawHistoricData) => { return this.innerHeight(this.defaultHeight) - this.yScale(d.volume) });
    this.svg.selectAll(".x-axis").call(this.xAxis);
    this.svg.selectAll(".y-axis").call(this.yAxis);
  }

  private resizeChart(): void {
    this.xRange = [0, this.innerWidth(this.defaultWidth)];
    this.xScale = d3.scaleBand(this.xDomain, this.xRange).paddingInner(this.xPadding).align(0.5);
    this.xTicks = this.weeksScale(d3.min(this.xDomain), d3.max(this.xDomain), 2, 0);
    var maxP: number = +this.setMaxValue(this.filteredData, "volume")
    var buffer = maxP * 0.1
    this.yMax = maxP + buffer
    this.yScale = this.yScale.rangeRound([this.innerHeight(this.defaultHeight), 0]);
    this.yMax = this.yScale.domain()[1];

    this.svg.select("#rect")
      .transition()
      .duration(0)
      .attr("width", this.innerWidth(this.defaultWidth))
      .attr("height", this.innerHeight(this.defaultHeight))
      .attr("transform", `translate(${this.margin.left}, ${this.margin.top})`)
    this.svg.select("#clip rect")
      .transition()
      .duration(0)
      .attr("width", this.innerWidth(this.defaultWidth))
      .attr("height", this.innerHeight(this.defaultHeight))
      .attr("transform", `translate(${this.margin.left}, ${this.margin.top})`)

    this.svg.select<SVGGElement>('#xAxis')
      .transition().ease(d3.easePolyInOut)
      .duration(this.transitionDuration)
      .attr('transform', `translate(${this.margin.left},${this.innerHeight(this.defaultHeight) + this.margin.top})`)
      .call(this.xAxis = d3.axisBottom(this.xScale).tickFormat(d3.utcFormat(this.xFormat)).tickValues(this.xTicks)).selectAll("path, line")
      .attr("stroke", 'azure');

    this.svg.select<SVGGElement>('#yAxis')
      .transition().ease(d3.easePolyInOut)
      .duration(this.transitionDuration)
      .attr('transform', `translate(${this.innerWidth(this.defaultWidth) + this.margin.left}, ${this.margin.top})`)
      .call(d3.axisRight(this.yScale).tickFormat(d3.format(",.0f")))
      .selectAll("path, line")
      .attr("stroke", 'azure');

    this.svg.selectAll("text").transition()
      .duration(this.transitionDuration)
      .attr("fill", 'azure');

    this.bars = this.clipPath.selectAll(".bar");
    this.bars
      .transition().ease(d3.easePolyInOut).duration(this.transitionDuration)
      .attr("x", (d: RawHistoricData) => { return this.margin.left + this.xScale(d.date) })
      .attr("width", this.xScale.bandwidth())
      .attr('y', (d: RawHistoricData) => { return this.yScale(d.volume) })
      .attr('height', (d: RawHistoricData) => { return this.innerHeight(this.defaultHeight) - this.yScale(d.volume) });
  }

}


