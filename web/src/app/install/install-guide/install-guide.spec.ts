import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InstallGuide } from './install-guide';

describe('InstallGuide', () => {
  let component: InstallGuide;
  let fixture: ComponentFixture<InstallGuide>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InstallGuide],
    }).compileComponents();

    fixture = TestBed.createComponent(InstallGuide);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
